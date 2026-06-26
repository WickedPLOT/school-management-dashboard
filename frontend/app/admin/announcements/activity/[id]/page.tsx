'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type RosterRow = { id: number; email: string; full_name?: string; attendance_status?: 'present' | 'absent' | 'late' | 'excused'; };
type Schedule = { id: number; title: string; schedule_date: string; start_time?: string; section_scope: string; repeat_mode: string; presenter_name?: string; };

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch(`/admin/daily-schedule/${id}/attendance`)
      .then((data) => { setSchedule(data.schedule); setRoster(data.roster); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function setStatus(userId: number, status: RosterRow['attendance_status']) {
    setRoster((r) => r.map((row) => row.id === userId ? { ...row, attendance_status: status } : row));
  }

  async function save() {
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiFetch(`/admin/daily-schedule/${id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ records: roster.map((r) => ({ user_id: r.id, status: r.attendance_status })).filter((r) => r.status) }),
      });
      setSuccess('Attendance saved.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally { setSaving(false); }
  }

  return (
    <div className="section-shell">
      <div className="page-header page-header-with-action">
        <button type="button" className="back-arrow-btn" onClick={() => router.back()}>← Back</button>
        <div>
          <h1>{schedule?.title || 'Activity Attendance'}</h1>
          <p>{schedule ? `${schedule.schedule_date} · ${schedule.start_time || ''} · ${schedule.section_scope}` : 'Loading...'}</p>
        </div>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div><h2>Mark Attendance</h2></div>
          <button type="button" className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1.25rem' }} onClick={save} disabled={saving || loading}>
            {saving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
        {success ? <div className="success-msg" style={{ margin: '1rem' }}>{success}</div> : null}

        {loading ? <div className="empty-state"><p>Loading roster...</p></div> : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead><tr><th>Student</th><th>Attendance</th></tr></thead>
              <tbody>
                {roster.map((row) => (
                  <tr key={row.id}>
                    <td><strong>{row.full_name || row.email}</strong><div className="table-muted">{row.email}</div></td>
                    <td>
                      <div className="event-actions">
                        {(['present', 'late', 'absent', 'excused'] as const).map((status) => (
                          <button key={status} type="button"
                            className={`attend-${status} ${row.attendance_status === status ? 'active' : ''}`}
                            style={{ width: 'auto', padding: '0.45rem 0.8rem' }}
                            onClick={() => setStatus(row.id, status)}>
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
