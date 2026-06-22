'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { centerNameForUser } from '@/lib/centers';

type Profile = {
  id: number; email: string; section: string; status: string; created_at: string;
  full_name?: string; gender?: string; phone?: string; institution?: string;
  course?: string; year_of_study?: number; quran_level?: string; home_county?: string;
  parent_name?: string; parent_phone?: string; parent_email?: string; alt_student_phone?: string; alt_parent_phone?: string;
  emergency_contact_1_name?: string; emergency_contact_1_phone?: string; emergency_contact_1_relation?: string;
  emergency_contact_2_name?: string; emergency_contact_2_phone?: string; emergency_contact_2_relation?: string;
  nationality?: string; country?: string; county?: string; sub_county?: string; passport_photo_data?: string; entry_date?: string;
  documents?: Array<{ id: number; document_type: string; file_name?: string; mime_type?: string; file_data?: string; review_status?: string; review_note?: string; updated_at?: string }>;
};

type AttendanceSummary = {
  marked_events: string;
  present_count: string;
  late_count: string;
  absent_count: string;
  excused_count: string;
  attendance_rate: string;
};

type RoomInfo = {
  building_name?: string;
  room_name?: string;
  capacity?: number;
  manager_name?: string;
};


const DOCUMENT_LABELS: Record<string, string> = {
  id_front: 'ID Front',
  id_back: 'ID Back',
  passport_document: 'Passport Document',
  good_conduct: 'Good Conduct',
  other_document: 'Other Document',
};

type MonthlyPerformance = {
  month: string;
  label: string;
  academic: number;
  religious: number;
  activity: number;
  counts?: { academic: number; religious: number; activity: number };
};

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function RingMetric({ label, value, suffix = '%', caption, color = 'var(--green)' }: { label: string; value: number; suffix?: string; caption: string; color?: string }) {
  const score = clampScore(value);
  return (
    <div className="student-performance-card">
      <div className="student-ring" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, #e8efe9 0deg)` }}>
        <div><strong>{score}{suffix}</strong><span>{label}</span></div>
      </div>
      <p>{caption}</p>
    </div>
  );
}

const ROWS = [
  ['Full Name', 'full_name'], ['Email', 'email'], ['Phone', 'phone'],
  ['Center', 'center_name'], ['Gender', 'gender'], ['Section', 'section'], ['Nationality', 'nationality'],
  ['Country', 'country'], ['County', 'county'], ['Sub-County', 'sub_county'], ['Home County', 'home_county'],
  ['Institution', 'institution'], ['Course', 'course'],
  ['Year of Study', 'year_of_study'], ["Qur'an Level", 'quran_level'],
  ['Entry Date', 'entry_date'], ['Status', 'status'],
] as const;

export default function StudentProfileViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [monthlyPerformance, setMonthlyPerformance] = useState<MonthlyPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch(`/admin/profiles/${id}`),
      apiFetch(`/admin/attendance/students/${id}/summary`),
      apiFetch(`/admin/accommodation/students/${id}`),
      apiFetch(`/admin/progress/students/${id}/monthly`),
    ])
      .then(([profileData, attendanceData, roomData, performanceData]) => {
        setProfile(profileData);
        setAttendance(attendanceData);
        setRoom(roomData);
        setMonthlyPerformance(performanceData?.months || []);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function action(type: 'approve' | 'reject') {
    try {
      await apiFetch(`/admin/${type}/${id}`, { method: 'PATCH' });
      setProfile((p) => (p ? { ...p, status: type === 'approve' ? 'approved' : 'rejected' } : p));
    } catch (e: any) { setError(e.message); }
  }

  function goToQuranDuty() {
    router.push(`/admin/quran?student=${id}`);
  }

  function goToMeeting() {
    router.push(`/admin/announcements?student=${id}`);
  }

  if (loading) return <div className="page-header"><p>Loading...</p></div>;
  if (error)   return <div className="page-header"><div className="error-msg">{error}</div></div>;
  if (!profile) return null;
  const centerName = centerNameForUser({ role: 'student', section: profile.section });
  const attendanceRate = toNumber(attendance?.attendance_rate);
  const markedEvents = toNumber(attendance?.marked_events);
  const presentEvents = toNumber(attendance?.present_count);
  const absentEvents = toNumber(attendance?.absent_count);
  const profileFields = ROWS.filter(([, key]) => key === 'center_name' || Boolean(profile[key as keyof Profile])).length;
  const profileCompletion = (profileFields / ROWS.length) * 100;
  const accommodationScore = room?.room_name ? 100 : 0;
  const absenceRiskScore = Math.max(0, 100 - absentEvents * 20);
  const hasMonthlyPerformance = monthlyPerformance.some((month) => month.academic || month.religious || month.activity);
  const chartPerformance = hasMonthlyPerformance ? monthlyPerformance : [];

  return (
    <div>
      <div className="page-header page-header-with-action">
        <button type="button" className="back-arrow-btn" onClick={() => router.back()} aria-label="Go back">← Back</button>
        <div className="page-header-main">
          <h1>{profile.full_name || 'Student Profile'}</h1>
          <p>{profile.email} · {centerName}</p>
        </div>
        <div className="page-header-actions">
          {profile.status === 'pending'  && <><button className="btn-approve" onClick={() => action('approve')}>Approve</button><button className="btn-reject" onClick={() => action('reject')}>Reject</button></>}
          {profile.status === 'rejected' && <button className="btn-approve" onClick={() => action('approve')}>Restore</button>}
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2>Profile Details</h2>
          <span className={`badge badge-${profile.status}`}>{profile.status}</span>
        </div>
        <div className="admin-profile-overview">
          <div className="admin-profile-photo-card">
            <div className="admin-profile-photo">
              {profile.passport_photo_data ? <img src={profile.passport_photo_data} alt="Passport photo" /> : <span>No Photo</span>}
            </div>
            <div>
              <strong>Passport Photo</strong>
              <p className="table-muted">Student record image for verification, dorm placement, and staff review.</p>
            </div>
          </div>
          <div className="student-performance-grid admin-profile-performance">
            <RingMetric label="Attendance" value={attendanceRate} caption={`${presentEvents} present from ${markedEvents} marked events`} />
            <RingMetric label="Profile" value={profileCompletion} caption={`${profileFields}/${ROWS.length} profile fields available`} color="#2563eb" />
            <RingMetric label="Accommodation" value={accommodationScore} caption={room?.room_name ? `${room.building_name || 'Building'} · ${room.room_name}` : 'No active room assignment'} color="#c9a84c" />
            <RingMetric label="Absence Risk" value={absenceRiskScore} caption={absentEvents ? `${absentEvents} absence record${absentEvents === 1 ? '' : 's'}` : 'No absence records'} color="#0f766e" />
          </div>
        </div>
        <div className="admin-profile-actions-inline">
          <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={goToQuranDuty}>
            Assign Qur'an Duty
          </button>
          <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={goToMeeting}>
            Schedule One-on-One Meeting
          </button>
        </div>
        <div className="admin-document-section">
          <div className="section-outline-header compact">
            <div>
              <h2>Student Documents</h2>
              <p>ID, passport, good conduct and other uploaded verification files.</p>
            </div>
          </div>
          <div className="admin-document-grid">
            {profile.documents?.length ? profile.documents.map((doc) => (
              <article key={doc.id} className="admin-document-card">
                <div>
                  <strong>{DOCUMENT_LABELS[doc.document_type] || doc.document_type}</strong>
                  <span>{doc.file_name || 'Uploaded document'}</span>
                  <small>Status: {doc.review_status || 'submitted'}</small>
                </div>
                {doc.file_data ? <a className="btn-outline" style={{ width: 'auto' }} href={doc.file_data} target="_blank" rel="noreferrer">View</a> : <span className="table-muted">No file</span>}
              </article>
            )) : <div className="empty-state compact"><p>No student documents uploaded yet.</p></div>}
          </div>
        </div>
        <div className="admin-profile-column-section student-monthly-performance">
          <div className="section-outline-header compact">
            <div>
              <h2>Monthly Performance Bar Graph</h2>
              <p>Academic, religious, and activity performance scores compared month by month.</p>
              {!hasMonthlyPerformance ? <p className="sample-chart-note">Showing sample data until real progress scores are recorded.</p> : null}
            </div>
            <div className="profile-chart-legend">
              <span><i style={{ background: '#2563eb' }} /> Academic</span>
              <span><i style={{ background: '#0f766e' }} /> Religious</span>
              <span><i style={{ background: '#c9a84c' }} /> Activities</span>
            </div>
          </div>
          <div className={`profile-grouped-chart ${hasMonthlyPerformance ? '' : 'is-empty'}`.trim()}>
              <div className="profile-column-y-axis"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div>
              <div className="profile-column-plot">
                <div className="profile-column-grid" aria-hidden="true"><span /><span /><span /><span /><span /></div>
                {chartPerformance.length ? (
                  <div className="profile-month-groups">
                    {chartPerformance.map((month) => (
                      <div key={month.month} className="profile-month-group">
                        <div className="profile-month-bars">
                          <div className="profile-month-bar academic" style={{ height: `${Math.max(4, clampScore(month.academic))}%` }} title={`Academic: ${clampScore(month.academic)}%`} />
                          <div className="profile-month-bar religious" style={{ height: `${Math.max(4, clampScore(month.religious))}%` }} title={`Religious: ${clampScore(month.religious)}%`} />
                          <div className="profile-month-bar activity" style={{ height: `${Math.max(4, clampScore(month.activity))}%` }} title={`Activities: ${clampScore(month.activity)}%`} />
                        </div>
                        <strong>{month.label}</strong>
                        <small>A {clampScore(month.academic)}% · R {clampScore(month.religious)}% · Act {clampScore(month.activity)}%</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state compact profile-chart-empty">
                    <p>No monthly performance scores yet. Ask the student or admin to submit progress updates for academic, religious, and activity tracking.</p>
                  </div>
                )}
              </div>
            </div>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {ROWS.map(([label, key]) => {
            let val: any = key === 'center_name' ? centerName : profile[key as keyof Profile];
            if (key === 'entry_date' && val) val = new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div key={key} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>{label}</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, textTransform: key === 'gender' || key === 'section' || key === 'status' ? 'capitalize' : 'none' }}>{val || '—'}</p>
              </div>
            );
          })}
        </div>

        <div className="emergency-contact-section">
          <div className="section-outline-header compact">
            <div>
              <h2>Emergency Contacts</h2>
              <p>Guardian and emergency contact information for staff follow-up.</p>
            </div>
          </div>
          <div className="emergency-contact-grid">
            {[
              ['Guardian Name', profile.parent_name || '—'],
              ['Guardian Phone', profile.parent_phone || '—'],
              ['Guardian Alt Phone', profile.alt_parent_phone || '—'],
              ['Guardian Email', profile.parent_email || '—'],
              ['Student Phone', profile.phone || '—'],
              ['Student Alt Phone', profile.alt_student_phone || '—'],
              ['Emergency Contact 1', `${profile.emergency_contact_1_name || '—'}${profile.emergency_contact_1_phone ? ` · ${profile.emergency_contact_1_phone}` : ''}${profile.emergency_contact_1_relation ? ` · ${profile.emergency_contact_1_relation}` : ''}`],
              ['Emergency Contact 2', `${profile.emergency_contact_2_name || '—'}${profile.emergency_contact_2_phone ? ` · ${profile.emergency_contact_2_phone}` : ''}${profile.emergency_contact_2_relation ? ` · ${profile.emergency_contact_2_relation}` : ''}`],
              ['Home County / Area', profile.home_county || '—'],
              ['Center', centerName],
            ].map(([label, value]) => (
              <div key={label} className="emergency-contact-card">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>


      <div className="settings-grid" style={{ marginTop: '1rem' }}>
        <div className="content-card">
          <div className="content-card-header">
            <h2>Attendance Summary</h2>
            <span className={`badge ${Number(attendance?.attendance_rate || 0) < 60 ? 'badge-failed' : 'badge-sent'}`}>
              {attendance?.attendance_rate || '0'}%
            </span>
          </div>
          <div className="profile-attendance-metrics">
            {[
              ['Marked', attendance?.marked_events || '0'],
              ['Present', attendance?.present_count || '0'],
              ['Late', attendance?.late_count || '0'],
              ['Absent', attendance?.absent_count || '0'],
              ['Excused', attendance?.excused_count || '0'],
            ].map(([label, value]) => (
              <div key={label} className="profile-attendance-metric">
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="content-card">
          <div className="content-card-header">
            <h2>Accommodation</h2>
            <span className={`badge ${room?.room_name ? 'badge-approved' : 'badge-pending'}`}>{room?.room_name ? 'Assigned' : 'Unassigned'}</span>
          </div>
          <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Building</p><p>{room?.building_name || '—'}</p></div>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Room</p><p>{room?.room_name || '—'}</p></div>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Manager</p><p>{room?.manager_name || '—'}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
