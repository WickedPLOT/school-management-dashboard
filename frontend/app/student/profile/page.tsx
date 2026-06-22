'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { centerNameForUser } from '@/lib/centers';

const FIELDS = [
  { name: 'full_name',     label: 'Full Name',           type: 'text',   span: 2 },
  { name: 'phone',         label: 'Phone Number',        type: 'text' },
  { name: 'alt_student_phone', label: 'Alternative Phone', type: 'text' },
  { name: 'parent_name',   label: 'Parent / Guardian',   type: 'text' },
  { name: 'parent_phone',  label: 'Parent Phone',        type: 'text' },
  { name: 'alt_parent_phone', label: 'Alternative Parent Phone', type: 'text' },
  { name: 'parent_email',  label: 'Parent Email',        type: 'email' },
  { name: 'gender',        label: 'Gender',              type: 'select', options: ['male', 'female'] },
  { name: 'institution',   label: 'Institution',         type: 'text',   span: 2 },
  { name: 'course',        label: 'Course / Programme',  type: 'text' },
  { name: 'year_of_study', label: 'Year of Study',       type: 'number' },
  { name: 'quran_level',   label: "Qur'an Level",        type: 'text' },
  { name: 'nationality',   label: 'Nationality',         type: 'text' },
  { name: 'country',       label: 'Country',             type: 'text' },
  { name: 'county',        label: 'County',              type: 'text' },
  { name: 'sub_county',    label: 'Sub-County',          type: 'text' },
  { name: 'home_county',   label: 'Home County / Area',  type: 'text' },
  { name: 'emergency_contact_1_name', label: 'Emergency Contact 1 Name', type: 'text' },
  { name: 'emergency_contact_1_phone', label: 'Emergency Contact 1 Phone', type: 'text' },
  { name: 'emergency_contact_1_relation', label: 'Emergency Contact 1 Relation', type: 'text' },
  { name: 'emergency_contact_2_name', label: 'Emergency Contact 2 Name', type: 'text' },
  { name: 'emergency_contact_2_phone', label: 'Emergency Contact 2 Phone', type: 'text' },
  { name: 'emergency_contact_2_relation', label: 'Emergency Contact 2 Relation', type: 'text' },
] as const;

const REQUIRED = ['full_name', 'phone', 'institution', 'course'];

const STUDENT_DOCUMENTS = [
  { key: 'id_front', label: 'ID Front' },
  { key: 'id_back', label: 'ID Back' },
  { key: 'passport_document', label: 'Passport Document' },
  { key: 'good_conduct', label: 'Good Conduct' },
  { key: 'other_document', label: 'Other Document' },
] as const;

type DashboardData = {
  attendance?: {
    attendance_rate?: string | number;
    marked_events?: string | number;
    present_count?: string | number;
    late_count?: string | number;
    absent_count?: string | number;
    excused_count?: string | number;
  };
  latest_update?: {
    track?: string;
    review_status?: string;
    progress_score?: string | number | null;
  } | null;
  latest_issue?: { status?: string } | null;
  quick_stats?: {
    attendance_rate?: number;
    unresolved_issues?: number;
    reviewed_updates?: number;
  };
};

type ProfileTab = 'personal' | 'academic' | 'room' | 'quran' | 'attendance';

type StudentUpdate = {
  id: number;
  track: 'academic' | 'religious' | 'activity';
  title: string;
  summary: string;
  details?: string;
  progress_score?: string | number | null;
  review_status: 'submitted' | 'reviewed';
  admin_note?: string;
  created_at: string;
};

type RoomInfo = {
  building_name?: string;
  room_name?: string;
  capacity?: number;
  manager_name?: string;
  assigned_at?: string;
};

type QuranAssignment = {
  id: number;
  title?: string;
  surah?: string;
  from_page?: string | number;
  to_page?: string | number;
  assigned_for?: string;
  status?: string;
  completed_at?: string;
  note?: string;
};

type AttendanceItem = {
  id: number;
  title: string;
  location?: string;
  event_date: string;
  attendance_status?: 'present' | 'late' | 'absent' | 'excused' | null;
  attendance_state?: string;
  reminder_text?: string;
};

type AttendanceData = {
  summary?: DashboardData['attendance'];
  history?: AttendanceItem[];
  upcoming?: AttendanceItem[];
};

type RingMetricProps = {
  label: string;
  value: number;
  suffix?: string;
  caption: string;
  color?: string;
};

function toNumber(value: unknown) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function RingMetric({ label, value, suffix = '%', caption, color = 'var(--green)' }: RingMetricProps) {
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

function PassportPhotoInput({ form, canEdit, setForm, setError }: { form: Record<string, string>; canEdit: boolean; setForm: (v: Record<string, string>) => void; setError: (v: string) => void }) {
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Passport photo must be an image file'); return; }
    if (file.size > 1024 * 1024 * 2) { setError('Passport photo must be below 2MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, passport_photo_data: String(reader.result || '') });
    reader.readAsDataURL(file);
  }

  return (
    <div className="profile-photo-panel">
      <div className="profile-photo-frame">
        {form.passport_photo_data ? <img src={form.passport_photo_data} alt="Passport photo" /> : <span>No Photo</span>}
      </div>
      <div>
        <h3>Passport Photo</h3>
        <p>Upload a clear student image for records, dorm placement, and admin verification.</p>
        <div className="profile-photo-actions">
          <label className={`btn-outline ${!canEdit ? 'disabled-control' : ''}`} style={{ width: 'auto', cursor: canEdit ? 'pointer' : 'not-allowed' }}>
            Upload Photo
            <input type="file" accept="image/*" disabled={!canEdit} onChange={handleFile} style={{ display: 'none' }} />
          </label>
          {form.passport_photo_data ? (
            <button type="button" className="btn-outline" style={{ width: 'auto' }} disabled={!canEdit} onClick={() => setForm({ ...form, passport_photo_data: '' })}>Remove</button>
          ) : null}
        </div>
      </div>
    </div>
  );
}


function StudentDocumentUploads({ form, canEdit, setForm, setError }: { form: Record<string, string>; canEdit: boolean; setForm: (v: Record<string, string>) => void; setError: (v: string) => void }) {
  function handleFile(key: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!allowed) { setError('Documents must be images or PDF files'); return; }
    if (file.size > 1024 * 1024 * 5) { setError('Each document must be below 5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, [`${key}_data`]: String(reader.result || ''), [`${key}_name`]: file.name, [`${key}_mime`]: file.type });
    reader.readAsDataURL(file);
  }

  return (
    <div className="student-documents-panel">
      <div className="section-outline-header compact"><div><h2>Student Documents</h2><p>ID, passport, good conduct and other verification documents.</p></div></div>
      <div className="document-upload-grid">
        {STUDENT_DOCUMENTS.map((doc) => (
          <div key={doc.key} className="field document-upload-card">
            <label>{doc.label}</label>
            <input type="file" accept="image/*,.pdf,application/pdf" disabled={!canEdit} onChange={(event) => handleFile(doc.key, event)} />
            {form[`${doc.key}_data`] ? (
              <div className="document-upload-preview"><span>{form[`${doc.key}_name`] || 'Uploaded document'}</span><button type="button" className="btn-outline" style={{ width: 'auto' }} disabled={!canEdit} onClick={() => { const next = { ...form }; delete next[`${doc.key}_data`]; delete next[`${doc.key}_name`]; delete next[`${doc.key}_mime`]; setForm(next); }}>Remove</button></div>
            ) : <p className="table-muted">Image or PDF, max 5MB.</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function StudentProfilePage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [dashboard, setDashboard] = useState<DashboardData>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('personal');
  const [updates, setUpdates] = useState<StudentUpdate[]>([]);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [quranAssignments, setQuranAssignments] = useState<QuranAssignment[]>([]);
  const [attendanceData, setAttendanceData] = useState<AttendanceData>({});

  useEffect(() => {
    Promise.all([
      apiFetch('/profile'),
      apiFetch('/profile/dashboard').catch(() => ({})),
      apiFetch('/profile/updates').catch(() => []),
      apiFetch('/profile/room').catch(() => null),
      apiFetch('/profile/quran-assignments').catch(() => []),
      apiFetch('/profile/attendance').catch(() => ({})),
      apiFetch('/admin/settings/public').catch(() => null),
    ]).then(([data, dashboardData, updateData, roomData, quranData, attendancePayload, publicSettings]) => {
      if (data) {
        const documentFields = Array.isArray(data.documents) ? data.documents.reduce((acc: Record<string, string>, doc: any) => {
          acc[`${doc.document_type}_data`] = doc.file_data || '';
          acc[`${doc.document_type}_name`] = doc.file_name || '';
          acc[`${doc.document_type}_mime`] = doc.mime_type || '';
          return acc;
        }, {}) : {};
        setForm({ ...data, ...documentFields });
        const incomplete = REQUIRED.some(k => !data[k]);
        setIsFirstTime(incomplete);
      } else {
        setIsFirstTime(true);
      }
      setDashboard(dashboardData || {});
      setUpdates(Array.isArray(updateData) ? updateData : []);
      setRoom(roomData || null);
      setQuranAssignments(Array.isArray(quranData) ? quranData : []);
      setAttendanceData(attendancePayload || {});
      if (publicSettings && publicSettings.allow_student_profile_edits === false) {
        setCanEdit(false);
      }
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);
    const missing = REQUIRED.filter(k => !form[k]);
    if (missing.length) { setError(`Please fill in: ${missing.join(', ').replace(/_/g, ' ')}`); return; }
    try {
      const savedProfile = await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(form) });
      setForm((current) => ({ ...current, ...savedProfile, passport_photo_data: current.passport_photo_data }));
      setSaved(true);
      setIsFirstTime(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const displayName = form.full_name || 'Student Profile';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'SP';
  const centerName = centerNameForUser({ role: 'student', section: form.section || (form.gender === 'female' ? 'sisters' : 'brothers') });
  const attendanceRate = toNumber(dashboard.quick_stats?.attendance_rate ?? dashboard.attendance?.attendance_rate);
  const latestScore = toNumber(dashboard.latest_update?.progress_score);
  const reviewedUpdates = toNumber(dashboard.quick_stats?.reviewed_updates);
  const openIssues = toNumber(dashboard.quick_stats?.unresolved_issues);
  const issueHealth = openIssues === 0 ? 100 : Math.max(0, 100 - openIssues * 20);
  const completedFields = useMemo(() => FIELDS.filter((field) => String(form[field.name] || '').trim()).length, [form]);
  const profileCompletion = FIELDS.length ? (completedFields / FIELDS.length) * 100 : 0;
  const profileChips = [
    centerName,
    'Active',
    form.quran_level || 'Qur’an level pending',
    form.institution || 'Institution pending',
  ];
  const extraReadOnlyFields = [
    ['Student ID', form.student_id || 'Assigned by admin'],
    ['Joined', form.entry_date ? new Date(form.entry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
  ] as const;

  const academicUpdates = updates.filter((item) => item.track === 'academic');
  const quranUpdates = updates.filter((item) => item.track === 'religious');
  const attendanceSummary = attendanceData.summary || dashboard.attendance || {};
  const attendanceHistory = Array.isArray(attendanceData.history) ? attendanceData.history : [];
  const upcomingEvents = Array.isArray(attendanceData.upcoming) ? attendanceData.upcoming : [];
  const quranCompleted = quranAssignments.filter((item) => item.status === 'completed').length;
  const profileTabs: Array<{ id: ProfileTab; label: string }> = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'academic', label: 'Academic' },
    { id: 'room', label: 'Room & Roommates' },
    { id: 'quran', label: "Qur'an Progress" },
    { id: 'attendance', label: 'Attendance' },
  ];

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Student Profile</h1>
        <p>Personal records, passport photo, academic details, and performance overview.</p>
      </div>

      {isFirstTime && (
        <div style={{
          background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
          borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem', color: 'white',
        }}>
          <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Welcome to {centerName}</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>
            Please complete your profile before accessing other features. Fields marked * are required.
          </p>
        </div>
      )}

      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Student Profile</h2>
            <p>Viewing: {displayName}</p>
          </div>
        </div>

        <div style={{ padding: '1rem' }}>
          <div className="profile-hero">
            <div className="profile-identity">
              <div className="profile-avatar">{form.passport_photo_data ? <img src={form.passport_photo_data} alt="Student profile" /> : initials}</div>
              <div>
                <h3>{displayName}</h3>
                <p>{form.email || 'student@example.com'} · {centerName}</p>
                <div className="profile-pill-row">
                  {profileChips.map((chip) => <span key={chip} className="profile-pill">{chip}</span>)}
                </div>
              </div>
            </div>
          </div>

          <div className="student-performance-grid">
            <RingMetric label="Attendance" value={attendanceRate} caption={`${dashboard.attendance?.present_count || 0} present, ${dashboard.attendance?.late_count || 0} late, ${dashboard.attendance?.absent_count || 0} absent`} />
            <RingMetric label="Progress" value={latestScore} caption={dashboard.latest_update ? `${dashboard.latest_update.track || 'Progress'} · ${dashboard.latest_update.review_status || 'submitted'}` : 'No reviewed progress score yet'} color="#c9a84c" />
            <RingMetric label="Profile" value={profileCompletion} caption={`${completedFields}/${FIELDS.length} profile fields completed`} color="#2563eb" />
            <RingMetric label="Conduct" value={issueHealth} caption={openIssues ? `${openIssues} open issue${openIssues === 1 ? '' : 's'} to resolve` : 'No open issues on record'} color="#0f766e" />
          </div>

          <div className="profile-tabs">
            {profileTabs.map((tab) => (
              <button key={tab.id} type="button" className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>

          {saved && <div className="success-msg" style={{ marginBottom: '1.25rem' }}>Profile saved successfully.</div>}
          {error && <div className="error-msg"   style={{ marginBottom: '1.25rem' }}>{error}</div>}
          {!canEdit && <div className="error-msg" style={{ marginBottom: '1.25rem' }}>Profile editing is currently disabled by the administrator.</div>}

          {activeTab === 'personal' ? (
          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <PassportPhotoInput form={form} canEdit={canEdit} setForm={setForm} setError={setError} />

            <StudentDocumentUploads form={form} canEdit={canEdit} setForm={setForm} setError={setError} />

            <div className="profile-detail-grid">
              {FIELDS.map(f => (
                <div key={f.name} className="profile-detail" style={'span' in f && f.span === 2 ? { gridColumn: 'span 1' } : {}}>
                  <label>
                    {f.label}
                    {REQUIRED.includes(f.name) && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select disabled={!canEdit} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}>
                      <option value="">Select...</option>
                      {'options' in f && f.options.map((o: string) => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      placeholder={f.label}
                      value={form[f.name] || ''}
                      disabled={!canEdit}
                      onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}

              {extraReadOnlyFields.map(([label, value]) => (
                <div key={label} className="profile-detail">
                  <label>{label}</label>
                  <input value={value} readOnly />
                </div>
              ))}
            </div>

            <div className="emergency-contact-section in-form">
              <div className="section-outline-header compact">
                <div>
                  <h2>Emergency Contacts</h2>
                  <p>Guardian and emergency contact information kept on your profile.</p>
                </div>
              </div>
              <div className="emergency-contact-grid">
                {[
                  ['Guardian Name', form.parent_name || '—'],
                  ['Guardian Phone', form.parent_phone || '—'],
                  ['Guardian Alt Phone', form.alt_parent_phone || '—'],
                  ['Guardian Email', form.parent_email || '—'],
                  ['Student Phone', form.phone || '—'],
                  ['Student Alt Phone', form.alt_student_phone || '—'],
                  ['Emergency Contact 1', `${form.emergency_contact_1_name || '—'}${form.emergency_contact_1_phone ? ` · ${form.emergency_contact_1_phone}` : ''}${form.emergency_contact_1_relation ? ` · ${form.emergency_contact_1_relation}` : ''}`],
                  ['Emergency Contact 2', `${form.emergency_contact_2_name || '—'}${form.emergency_contact_2_phone ? ` · ${form.emergency_contact_2_phone}` : ''}${form.emergency_contact_2_relation ? ` · ${form.emergency_contact_2_relation}` : ''}`],
                  ['Home County / Area', form.home_county || '—'],
                  ['Center', centerName],
                ].map(([label, value]) => (
                  <div key={label} className="emergency-contact-card">
                    <span>{label}</span>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="profile-form-actions">
              <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '1.5rem' }} disabled={!canEdit}>
                Save Profile
              </button>
            </div>
          </form>
          ) : null}

          {activeTab === 'academic' ? (
            <div className="student-profile-tab-panel">
              <div className="profile-detail-grid">
                {[
                  ['Institution', form.institution || '—'],
                  ['Course / Programme', form.course || '—'],
                  ['Year of Study', form.year_of_study || '—'],
                  ['Latest Academic Score', academicUpdates[0]?.progress_score ?? '—'],
                ].map(([label, value]) => (
                  <div key={label} className="profile-detail"><label>{label}</label><input value={value} readOnly /></div>
                ))}
              </div>
              <div className="review-stack" style={{ marginTop: '1rem' }}>
                {academicUpdates.length ? academicUpdates.map((item) => (
                  <article key={item.id} className="review-card">
                    <div className="review-card-head"><div><h3>{item.title}</h3><p>{new Date(item.created_at).toLocaleDateString('en-GB')}</p></div><span className={`badge badge-${item.review_status === 'reviewed' ? 'approved' : 'pending'}`}>{item.review_status}</span></div>
                    <p className="review-details">{item.summary}</p>
                    {item.details ? <p className="review-details">{item.details}</p> : null}
                    <div className="review-meta-grid"><div><strong>Score</strong><span>{item.progress_score ?? '—'}</span></div><div><strong>Comment</strong><span>{item.admin_note || 'No note yet'}</span></div></div>
                  </article>
                )) : <div className="empty-state compact"><p>No academic progress updates yet.</p></div>}
              </div>
            </div>
          ) : null}

          {activeTab === 'room' ? (
            <div className="student-profile-tab-panel">
              {!room?.room_name ? <div className="empty-state compact"><p>You have not been assigned a room yet.</p></div> : (
                <article className="review-card">
                  <div className="review-card-head"><div><h3>{room.room_name}</h3><p>{room.building_name || 'Building pending'}</p></div><span className="badge badge-approved">Assigned</span></div>
                  <div className="review-meta-grid">
                    <div><strong>Building</strong><span>{room.building_name || '—'}</span></div>
                    <div><strong>Room</strong><span>{room.room_name || '—'}</span></div>
                    <div><strong>Capacity</strong><span>{room.capacity || '—'} students</span></div>
                    <div><strong>Manager</strong><span>{room.manager_name || '—'}</span></div>
                    <div><strong>Assigned</strong><span>{room.assigned_at ? new Date(room.assigned_at).toLocaleDateString('en-GB') : '—'}</span></div>
                  </div>
                </article>
              )}
            </div>
          ) : null}

          {activeTab === 'quran' ? (
            <div className="student-profile-tab-panel">
              <div className="stats-grid">
                <div className="stat-card"><div><h3>{quranAssignments.length}</h3><p>Assigned Duties</p></div></div>
                <div className="stat-card"><div><h3>{quranCompleted}</h3><p>Completed</p></div></div>
                <div className="stat-card"><div><h3>{quranUpdates.length}</h3><p>Religious Updates</p></div></div>
              </div>
              <div className="review-stack" style={{ marginTop: '1rem' }}>
                {quranAssignments.length ? quranAssignments.map((item) => (
                  <article key={item.id} className="review-card">
                    <div className="review-card-head"><div><h3>{item.title || item.surah || "Qur'an Assignment"}</h3><p>{item.assigned_for ? new Date(item.assigned_for).toLocaleDateString('en-GB') : 'No date set'}</p></div><span className={`badge badge-${item.status === 'completed' ? 'approved' : 'pending'}`}>{item.status || 'assigned'}</span></div>
                    <div className="review-meta-grid"><div><strong>Pages</strong><span>{item.from_page || '—'} to {item.to_page || '—'}</span></div><div><strong>Completed</strong><span>{item.completed_at ? new Date(item.completed_at).toLocaleDateString('en-GB') : 'Not completed'}</span></div></div>
                    {item.note ? <p className="review-details">{item.note}</p> : null}
                  </article>
                )) : <div className="empty-state compact"><p>No Qur'an assignments yet.</p></div>}
              </div>
            </div>
          ) : null}

          {activeTab === 'attendance' ? (
            <div className="student-profile-tab-panel">
              <div className="stats-grid">
                {[
                  ['Attendance Rate', `${Number(attendanceSummary.attendance_rate || 0)}%`],
                  ['Present', Number(attendanceSummary.present_count || 0)],
                  ['Late', Number(attendanceSummary.late_count || 0)],
                  ['Absent', Number(attendanceSummary.absent_count || 0)],
                ].map(([label, value]) => <div key={label} className="stat-card"><div><h3>{value}</h3><p>{label}</p></div></div>)}
              </div>
              <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', marginTop: '1rem' }}>
                <section className="content-card"><div className="content-card-header"><h2>Upcoming Events</h2></div><div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>{upcomingEvents.length ? upcomingEvents.map((item) => <div key={item.id}><strong>{item.title}</strong><p className="table-muted">{new Date(item.event_date).toLocaleString('en-GB')}{item.location ? ` · ${item.location}` : ''}</p></div>) : <p>No upcoming events right now.</p>}</div></section>
                <section className="content-card"><div className="content-card-header"><h2>Attendance History</h2></div><div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>{attendanceHistory.length ? attendanceHistory.slice(0, 8).map((item) => <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}><span>{item.title}</span><span className={`badge badge-${item.attendance_status || 'pending'}`}>{item.attendance_status || item.attendance_state || 'pending'}</span></div>) : <p>No attendance records yet.</p>}</div></section>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
