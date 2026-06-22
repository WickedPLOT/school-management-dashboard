'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type RosterRow = {
  id: number;
  email: string;
  full_name?: string;
  phone?: string;
  institution?: string;
  course?: string;
  attendance_status?: 'present' | 'absent' | 'late' | 'excused';
};

type EventData = {
  id: number;
  title: string;
  description?: string;
  location?: string;
  event_date: string;
  section_scope: string;
};

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/admin/attendance/events/${id}`);
      setEvent(data.event);
      setRoster(data.roster);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  function setStatus(userId: number, status: RosterRow['attendance_status']) {
    setRoster((current) => current.map((row) => row.id === userId ? { ...row, attendance_status: status } : row));
  }

  async function saveAttendance() {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/admin/attendance/events/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          records: roster.map((row) => ({ user_id: row.id, status: row.attendance_status })).filter((row) => row.status),
        }),
      });
      setSuccess('Attendance saved.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header page-header-with-action">
        <button type="button" className="back-arrow-btn" onClick={() => router.back()} aria-label="Go back">← Back</button>
        <div>
          <h1>{event?.title || 'Event Register'}</h1>
          <p>Mark present, late, absent, or excused for each student in this event.</p>
        </div>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Event Details</h2>
            <p>{event ? `${new Date(event.event_date).toLocaleString('en-GB')} · ${event.location || 'No location set'}` : 'Loading event details...'}</p>
          </div>
          <button type="button" className="btn-primary" style={{ width: 'auto', paddingInline: '1.25rem' }} onClick={saveAttendance} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
        {success ? <div className="success-msg" style={{ margin: '1rem' }}>{success}</div> : null}

        {loading ? (
          <div className="empty-state"><p>Loading roster...</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Institution</th>
                  <th>Course</th>
                  <th>Attendance</th>
                </tr>
              </thead>
              <tbody>
                {roster.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.full_name || row.email}</strong>
                      <div className="table-muted">{row.email}</div>
                    </td>
                    <td>{row.institution || '—'}</td>
                    <td>{row.course || '—'}</td>
                    <td>
                      <div className="event-actions">
                        {(['present', 'late', 'absent', 'excused'] as const).map((status) => (
                          <button
                            key={status}
                            type="button"
                            className={status === 'present' ? `attend-present ${row.attendance_status === status ? 'active' : ''}` : status === 'late' ? `attend-late ${row.attendance_status === status ? 'active' : ''}` : status === 'absent' ? `attend-absent ${row.attendance_status === status ? 'active' : ''}` : `attend-excused ${row.attendance_status === status ? 'active' : ''}`}
                            style={{ width: 'auto', padding: '0.45rem 0.8rem' }}
                            onClick={() => setStatus(row.id, status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
