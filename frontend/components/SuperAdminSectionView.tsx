'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type SectionKey = 'brothers' | 'sisters';

type Student = {
  id: number;
  email: string;
  section: SectionKey;
  status: string;
  full_name?: string;
  institution?: string;
  course?: string;
  created_at?: string;
};

type Admin = {
  id: number;
  email: string;
  role: string;
  section: SectionKey;
  status: string;
  created_at: string;
};

type Building = {
  id: number;
  name: string;
  manager_name?: string;
  section_scope: SectionKey;
  rooms: Array<{
    id: number;
    name: string;
    capacity: number;
    occupied: number;
  }>;
  unassigned: Array<{ id: number }>;
};

type Issue = {
  id: number;
  title: string;
  status: 'pending' | 'inprogress' | 'resolved';
  section: SectionKey;
  full_name?: string;
  updated_at: string;
};

type Attendance = {
  id: number;
  full_name?: string;
  email: string;
  section: SectionKey;
  attendance_rate: number | string;
  marked_events: number | string;
};

type EventItem = {
  id: number;
  title: string;
  event_date: string;
  section_scope: 'brothers' | 'sisters' | 'all';
  location?: string;
};

type LoadState = {
  students: Student[];
  pending: Student[];
  rejected: Student[];
  incomplete: Student[];
  admins: Admin[];
  buildings: Building[];
  issues: Issue[];
  attendance: Attendance[];
  events: EventItem[];
};

const EMPTY_STATE: LoadState = {
  students: [],
  pending: [],
  rejected: [],
  incomplete: [],
  admins: [],
  buildings: [],
  issues: [],
  attendance: [],
  events: [],
};

function titleCase(section: SectionKey) {
  return section === 'brothers' ? 'Brothers' : 'Sisters';
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SuperAdminSectionView({ section }: { section: SectionKey }) {
  const [data, setData] = useState<LoadState>(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [adminError, setAdminError] = useState('');
  const [adminForm, setAdminForm] = useState({ email: '', password: '' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [
        students,
        pending,
        rejected,
        incomplete,
        admins,
        buildings,
        issues,
        attendance,
        events,
      ] = await Promise.all([
        apiFetch('/admin/students'),
        apiFetch('/admin/pending-users'),
        apiFetch('/admin/students/rejected'),
        apiFetch('/admin/profiles/incomplete'),
        apiFetch('/admin/admins'),
        apiFetch('/admin/accommodation/overview'),
        apiFetch('/admin/issues/reports'),
        apiFetch('/admin/attendance/overview'),
        apiFetch('/admin/attendance/events'),
      ]);
      setData({ students, pending, rejected, incomplete, admins, buildings, issues, attendance, events });
    } catch (err) {
      if (err instanceof Error) setError(err.message);
      else setError('Failed to load section data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [section]);

  const title = titleCase(section);
  const students = useMemo(() => data.students.filter((item) => item.section === section), [data.students, section]);
  const pending = useMemo(() => data.pending.filter((item) => item.section === section), [data.pending, section]);
  const rejected = useMemo(() => data.rejected.filter((item) => item.section === section), [data.rejected, section]);
  const incomplete = useMemo(() => data.incomplete.filter((item) => item.section === section), [data.incomplete, section]);
  const admins = useMemo(() => data.admins.filter((item) => item.section === section && item.status !== 'rejected'), [data.admins, section]);
  const activeAdmin = admins[0] || null;
  const buildings = useMemo(() => data.buildings.filter((item) => item.section_scope === section), [data.buildings, section]);
  const issues = useMemo(() => data.issues.filter((item) => item.section === section), [data.issues, section]);
  const attendance = useMemo(() => data.attendance.filter((item) => item.section === section), [data.attendance, section]);
  const events = useMemo(() => data.events.filter((item) => item.section_scope === section || item.section_scope === 'all'), [data.events, section]);

  const totalCapacity = buildings.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + Number(room.capacity || 0), 0), 0);
  const totalOccupied = buildings.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + Number(room.occupied || 0), 0), 0);
  const unresolvedIssues = issues.filter((item) => item.status !== 'resolved');
  const averageAttendance = attendance.length
    ? Math.round(attendance.reduce((sum, item) => sum + Number(item.attendance_rate || 0), 0) / attendance.length)
    : 0;
  const topAttendance = [...attendance]
    .sort((a, b) => Number(b.attendance_rate || 0) - Number(a.attendance_rate || 0))
    .slice(0, 5);

  async function saveAdmin(e: React.FormEvent) {
    e.preventDefault();
    setSavingAdmin(true);
    setAdminError('');
    try {
      if (activeAdmin) {
        await apiFetch(`/admin/admins/${activeAdmin.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            email: adminForm.email || activeAdmin.email,
            password: adminForm.password || undefined,
          }),
        });
      } else {
        await apiFetch('/admin/admins', {
          method: 'POST',
          body: JSON.stringify({
            email: adminForm.email,
            password: adminForm.password,
            section,
          }),
        });
      }
      setAdminForm({ email: '', password: '' });
      setShowAdminModal(false);
      await load();
    } catch (err) {
      if (err instanceof Error) setAdminError(err.message);
      else setAdminError('Failed to save admin');
    } finally {
      setSavingAdmin(false);
    }
  }

  async function deactivateAdmin() {
    if (!activeAdmin || !confirm(`Deactivate the ${title.toLowerCase()} admin account?`)) return;
    try {
      await apiFetch(`/admin/admins/${activeAdmin.id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>{title} Section</h1>
        <p>Super-admin overview for the {title.toLowerCase()} side of the platform.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><h3>{students.length}</h3><p>Approved Students</p></div></div>
        <div className="stat-card"><div><h3>{pending.length}</h3><p>Pending Approvals</p></div></div>
        <div className="stat-card"><div><h3>{buildings.length}</h3><p>Dorm Buildings</p></div></div>
        <div className="stat-card"><div><h3>{unresolvedIssues.length}</h3><p>Open Issues</p></div></div>
      </div>

      {error ? <div className="error-msg" style={{ marginBottom: '1rem' }}>{error}</div> : null}

      <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <section className="content-card">
          <div className="content-card-header">
            <h2>Section Admin</h2>
            <button className="btn-primary" style={{ width: 'auto', padding: '0.55rem 1rem' }} onClick={() => {
              setAdminError('');
              setAdminForm({ email: activeAdmin?.email || '', password: '' });
              setShowAdminModal(true);
            }}>
              {activeAdmin ? 'Manage Admin' : 'Assign Admin'}
            </button>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.85rem' }}>
            {loading ? <p>Loading section admin...</p> : null}
            {!loading && activeAdmin ? (
              <>
                <div><strong>{activeAdmin.email}</strong></div>
                <div className="reg-meta">
                  <span className="badge" style={{ background: '#d1fae5', color: '#166534' }}>Active</span>
                  <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>{title} admin</span>
                </div>
                <div style={{ color: 'var(--muted)' }}>Assigned on {formatDate(activeAdmin.created_at)}</div>
                <button className="btn-reject" style={{ width: 'auto' }} onClick={deactivateAdmin}>Deactivate Admin</button>
              </>
            ) : null}
            {!loading && !activeAdmin ? <p>No active {title.toLowerCase()} admin is assigned yet.</p> : null}
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <h2>Section Health</h2>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
            <div><strong>{rejected.length}</strong> rejected accounts</div>
            <div><strong>{incomplete.length}</strong> incomplete profiles</div>
            <div><strong>{events.length}</strong> events linked to this section</div>
            <div><strong>{averageAttendance}%</strong> average attendance rate</div>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <h2>Accommodation</h2>
            <Link href="/admin/accommodation/rooms" className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.9rem' }}>Open Accommodation</Link>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
            <div><strong>{buildings.length}</strong> dorm buildings</div>
            <div><strong>{totalOccupied}/{totalCapacity}</strong> occupied beds</div>
            <div><strong>{buildings.reduce((sum, building) => sum + building.unassigned.length, 0)}</strong> unassigned students</div>
            {buildings.slice(0, 3).map((building) => (
              <div key={building.id} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.85rem' }}>
                <strong>{building.name}</strong>
                <div style={{ color: 'var(--muted)', marginTop: '0.35rem' }}>
                  {building.rooms.length} rooms • {building.manager_name || 'No manager set'}
                </div>
              </div>
            ))}
            {!loading && buildings.length === 0 ? <p>No dorm buildings added for this section yet.</p> : null}
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <h2>Recent Issues</h2>
            <Link href="/admin/issues/pending" className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.9rem' }}>Open Issues</Link>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
            {issues.slice(0, 5).map((issue) => (
              <div key={issue.id} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center' }}>
                  <strong>{issue.title}</strong>
                  <span className="badge" style={{ background: issue.status === 'resolved' ? '#d1fae5' : '#fef3c7', color: issue.status === 'resolved' ? '#166534' : '#92400e' }}>
                    {issue.status}
                  </span>
                </div>
                <div style={{ color: 'var(--muted)', marginTop: '0.4rem' }}>
                  {issue.full_name || 'Unknown student'} • {formatDate(issue.updated_at)}
                </div>
              </div>
            ))}
            {!loading && issues.length === 0 ? <p>No issues recorded for this section.</p> : null}
          </div>
        </section>

        <section className="content-card" style={{ gridColumn: '1 / -1' }}>
          <div className="content-card-header">
            <h2>Students Overview</h2>
            <Link href="/admin/students/all" className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.9rem' }}>Open Full Student List</Link>
          </div>
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Institution</th>
                  <th>Course</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.slice(0, 8).map((student) => (
                  <tr key={student.id}>
                    <td>
                      <div className="pending-student-meta">
                        <strong>{student.full_name || student.email}</strong>
                        <span>{student.email}</span>
                      </div>
                    </td>
                    <td>{student.institution || '—'}</td>
                    <td>{student.course || '—'}</td>
                    <td><span className="badge" style={{ background: '#d1fae5', color: '#166534' }}>approved</span></td>
                  </tr>
                ))}
                {!loading && students.length === 0 ? (
                  <tr><td colSpan={4} className="table-muted">No approved students in this section yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <h2>Upcoming / Recent Events</h2>
            <Link href="/admin/resources/events" className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.9rem' }}>Open Calendar</Link>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
            {events.slice(0, 5).map((event) => (
              <div key={event.id} style={{ border: '1px solid var(--border)', borderRadius: '0.75rem', padding: '0.85rem' }}>
                <strong>{event.title}</strong>
                <div style={{ color: 'var(--muted)', marginTop: '0.4rem' }}>
                  {formatDate(event.event_date)} • {event.location || 'No location'}
                </div>
              </div>
            ))}
            {!loading && events.length === 0 ? <p>No events for this section yet.</p> : null}
          </div>
        </section>

        <section className="content-card">
          <div className="content-card-header">
            <h2>Top Attendance</h2>
            <Link href="/admin/attendance/records" className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.9rem' }}>Open Attendance</Link>
          </div>
          <div style={{ padding: '1.25rem', display: 'grid', gap: '0.75rem' }}>
            {topAttendance.map((item) => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', borderBottom: '1px solid #edf3ef', paddingBottom: '0.65rem' }}>
                <div>
                  <strong>{item.full_name || item.email}</strong>
                  <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>{Number(item.marked_events || 0)} marked events</div>
                </div>
                <strong>{Number(item.attendance_rate || 0)}%</strong>
              </div>
            ))}
            {!loading && topAttendance.length === 0 ? <p>No attendance records yet for this section.</p> : null}
          </div>
        </section>
      </div>

      {showAdminModal ? (
        <div
          className="page-modal-backdrop"
          onClick={() => setShowAdminModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8, 18, 12, 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 160 }}
        >
          <div
            className="page-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100%, 520px)', border: '1px solid #d7e6dc', borderRadius: '1rem', background: 'white', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.18)', overflow: 'hidden' }}
          >
            <div className="section-outline-header">
              <div>
                <h2>{activeAdmin ? `Manage ${title} Admin` : `Assign ${title} Admin`}</h2>
                <p>{activeAdmin ? 'Update the existing section admin account.' : 'Create the admin account for this section.'}</p>
              </div>
            </div>
            <form onSubmit={saveAdmin} className="form-stack" style={{ padding: '1rem' }}>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((current) => ({ ...current, email: e.target.value }))}
                  placeholder={`${section}.admin@hayrat.com`}
                  required
                />
              </div>
              <div className="field">
                <label>{activeAdmin ? 'New Password' : 'Password'}</label>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((current) => ({ ...current, password: e.target.value }))}
                  placeholder={activeAdmin ? 'Leave blank to keep the current password' : 'Minimum 6 characters'}
                  minLength={activeAdmin ? undefined : 6}
                  required={!activeAdmin}
                />
              </div>
              {adminError ? <div className="error-msg">{adminError}</div> : null}
              <div className="event-actions">
                <button type="button" className="btn-outline" onClick={() => setShowAdminModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={savingAdmin}>
                  {savingAdmin ? 'Saving...' : activeAdmin ? 'Update Admin' : 'Assign Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
