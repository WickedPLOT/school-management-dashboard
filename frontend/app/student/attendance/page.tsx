'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type AttendanceSummary = {
  marked_events?: string;
  present_count?: string;
  late_count?: string;
  absent_count?: string;
  excused_count?: string;
  attendance_rate?: string;
};

type AttendanceItem = {
  id: number;
  title: string;
  location?: string;
  event_date: string;
  section_scope: 'brothers' | 'sisters' | 'all';
  attendance_status?: 'present' | 'late' | 'absent' | 'excused' | null;
  attendance_state?: string;
  reminder_text?: string;
};

export default function Page() {
  const [summary, setSummary] = useState<AttendanceSummary>({});
  const [history, setHistory] = useState<AttendanceItem[]>([]);
  const [upcoming, setUpcoming] = useState<AttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/profile/attendance')
      .then((data) => {
        setSummary(data.summary || {});
        setHistory(Array.isArray(data.history) ? data.history : []);
        setUpcoming(Array.isArray(data.upcoming) ? data.upcoming : []);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => ([
    { label: 'Attendance Rate', value: `${Number(summary.attendance_rate || 0)}%` },
    { label: 'Present', value: Number(summary.present_count || 0) },
    { label: 'Late', value: Number(summary.late_count || 0) },
    { label: 'Absent', value: Number(summary.absent_count || 0) },
  ]), [summary]);

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Attendance</h1>
        <p>Track your attendance history, upcoming events, and reminders from one place.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}
      {loading ? <div className="empty-state"><p>Loading attendance...</p></div> : null}

      {!loading ? (
        <>
          <div className="stats-grid">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card"><div><h3>{stat.value}</h3><p>{stat.label}</p></div></div>
            ))}
          </div>

          <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
            <section className="content-card">
              <div className="content-card-header"><h2>Upcoming Events</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                {upcoming.length === 0 ? <p>No upcoming events right now.</p> : upcoming.map((item) => (
                  <div key={item.id} style={{ borderBottom: '1px solid #edf3ef', paddingBottom: '0.75rem' }}>
                    <strong>{item.title}</strong>
                    <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {new Date(item.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {item.location ? ` · ${item.location}` : ''}
                    </div>
                    <div style={{ color: '#1e7a4b', marginTop: '0.35rem', fontSize: '0.82rem' }}>{item.reminder_text}</div>
                  </div>
                ))}
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header"><h2>Attendance History</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                {history.length === 0 ? <p>No attendance records yet.</p> : history.map((item) => (
                  <div key={item.id} style={{ borderBottom: '1px solid #edf3ef', paddingBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <strong>{item.title}</strong>
                      <span className={`badge badge-${item.attendance_status || 'pending'}`}>{item.attendance_status || item.attendance_state || 'pending'}</span>
                    </div>
                    <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {new Date(item.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
