'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import AnalyticsDashboard from '@/components/AnalyticsDashboard';

type EventRow = { id: number; title: string; location?: string; event_date: string; present_count: string; absent_count: string; };
type Schedule = { id: number; title: string; start_time?: string; schedule_date: string; repeat_mode: string; presenter_name?: string; day_presenters?: { day_of_week: number; presenter_name?: string }[]; };

export default function Page() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [pending, setPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    Promise.all([
      apiFetch('/admin/attendance/events'),
      apiFetch('/admin/daily-schedule'),
      apiFetch('/admin/dashboard'),
    ]).then(([ev, sc, st]) => {
      setEvents(Array.isArray(ev) ? ev : []);
      setSchedules(Array.isArray(sc) ? sc : []);
      setPending(st?.pending || 0);
    }).finally(() => setLoading(false));
  }, []);

  const todaysEvents = useMemo(() =>
    events.filter((e) => new Date(e.event_date).toISOString().slice(0, 10) === today),
  [events, today]);

  const todaysActivities = useMemo(() =>
    schedules.filter((s) => s.schedule_date === today || s.repeat_mode === 'daily' || s.repeat_mode === 'weekly'),
  [schedules, today]);

  function getPresenter(a: Schedule) {
    if (a.repeat_mode === 'weekly' && a.day_presenters?.length) {
      const dp = a.day_presenters.find((d) => d.day_of_week === new Date().getDay());
      return dp?.presenter_name || '—';
    }
    return a.presenter_name || '—';
  }

  const todayPanel = !loading && (todaysEvents.length > 0 || todaysActivities.length > 0) ? (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', marginBottom: '1.5rem' }}>
      <section className="section-outline" style={{ margin: 0 }}>
        <div className="section-outline-header"><div><h2>Today&apos;s Events</h2></div></div>
        {todaysEvents.length === 0
          ? <p style={{ padding: '1rem', color: 'var(--muted)' }}>No events today.</p>
          : (
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead><tr><th>Event</th><th>Time</th><th>✓</th><th>✗</th><th /></tr></thead>
                <tbody>
                  {todaysEvents.map((e) => (
                    <tr key={e.id}>
                      <td><strong>{e.title}</strong>{e.location ? <div className="table-muted">{e.location}</div> : null}</td>
                      <td>{new Date(e.event_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td><span className="badge badge-approved">{e.present_count}</span></td>
                      <td><span className="badge badge-rejected">{e.absent_count}</span></td>
                      <td><Link href={`/admin/attendance/events/${e.id}`} className="btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>Register</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <section className="section-outline" style={{ margin: 0 }}>
        <div className="section-outline-header"><div><h2>Today&apos;s Activities</h2></div></div>
        {todaysActivities.length === 0
          ? <p style={{ padding: '1rem', color: 'var(--muted)' }}>No activities today.</p>
          : (
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead><tr><th>Activity</th><th>Time</th><th>Presenter</th><th /></tr></thead>
                <tbody>
                  {todaysActivities.map((a) => (
                    <tr key={a.id}>
                      <td><strong>{a.title}</strong></td>
                      <td>{a.start_time || '—'}</td>
                      <td>{getPresenter(a)}</td>
                      <td><Link href={`/admin/announcements/activity/${a.id}`} className="btn-primary" style={{ padding: '0.3rem 0.7rem', fontSize: '0.78rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>Attendance</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>
    </div>
  ) : null;

  return (
    <AnalyticsDashboard
      focus="overview"
      title="Dashboard"
      description="Live analytics across centers, students, accommodation, attendance, issues, programs, and communication."
      todayPanel={todayPanel}
      quickActions={
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/admin/announcements" className="btn-primary" style={{ width: 'auto', textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>+ Daily Activity</Link>
          <Link href="/admin/attendance/mark" className="btn-primary" style={{ width: 'auto', textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>+ Event</Link>
          {pending > 0 ? <Link href="/admin/students/pending" className="btn-outline" style={{ width: 'auto', textDecoration: 'none', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>Pending ({pending})</Link> : null}
        </div>
      }
    />
  );
}
