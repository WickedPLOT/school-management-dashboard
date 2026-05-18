'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Profile = {
  id: number; email: string; section: string; status: string; created_at: string;
  full_name?: string; gender?: string; phone?: string; institution?: string;
  course?: string; year_of_study?: number; quran_level?: string; home_county?: string;
  parent_name?: string; parent_phone?: string; parent_email?: string;
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

const ROWS = [
  ['Full Name', 'full_name'], ['Email', 'email'], ['Phone', 'phone'],
  ['Gender', 'gender'], ['Section', 'section'], ['Home County', 'home_county'],
  ['Institution', 'institution'], ['Course', 'course'],
  ['Year of Study', 'year_of_study'], ["Qur'an Level", 'quran_level'],
  ['Status', 'status'], ['Registered', 'created_at'],
] as const;

export default function StudentProfileViewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch(`/admin/profiles/${id}`),
      apiFetch(`/admin/attendance/students/${id}/summary`),
      apiFetch(`/admin/accommodation/students/${id}`),
    ])
      .then(([profileData, attendanceData, roomData]) => {
        setProfile(profileData);
        setAttendance(attendanceData);
        setRoom(roomData);
      })
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function action(type: 'approve' | 'reject') {
    try {
      await apiFetch(`/admin/${type}/${id}`, { method: 'PATCH' });
      setProfile(p => p ? { ...p, status: type === 'approve' ? 'approved' : 'rejected' } : p);
    } catch (e: any) { alert(e.message); }
  }

  if (loading) return <div className="page-header"><p>Loading...</p></div>;
  if (error)   return <div className="page-header"><div className="error-msg">{error}</div></div>;
  if (!profile) return null;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>{profile.full_name || 'Student Profile'}</h1>
          <p>{profile.email}</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {profile.status === 'pending'  && <><button className="btn-approve" onClick={() => action('approve')}>Approve</button><button className="btn-reject" onClick={() => action('reject')}>Reject</button></>}
          {profile.status === 'rejected' && <button className="btn-approve" onClick={() => action('approve')}>Restore</button>}
          <button onClick={() => router.back()} style={{ background: '#f3f4f6', border: 'none', borderRadius: '0.5rem', padding: '0.375rem 0.875rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>Back</button>
        </div>
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2>Profile Details</h2>
          <span className={`badge badge-${profile.status}`}>{profile.status}</span>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          {ROWS.map(([label, key]) => {
            let val: any = profile[key as keyof Profile];
            if (key === 'created_at' && val) val = new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
            return (
              <div key={key} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                <p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.2rem' }}>{label}</p>
                <p style={{ fontSize: '0.875rem', fontWeight: 500, textTransform: key === 'gender' || key === 'section' || key === 'status' ? 'capitalize' : 'none' }}>{val || '—'}</p>
              </div>
            );
          })}
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
          <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Marked Events</p><p>{attendance?.marked_events || '0'}</p></div>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Present</p><p>{attendance?.present_count || '0'}</p></div>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Late</p><p>{attendance?.late_count || '0'}</p></div>
            <div><p style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>Absent</p><p>{attendance?.absent_count || '0'}</p></div>
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
