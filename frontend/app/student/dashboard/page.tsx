'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Modal from '@/components/Modal';

type DashboardData = {
  attendance?: { attendance_rate?: string; present_count?: string; late_count?: string; absent_count?: string; };
  upcoming_events?: Array<{ id: number; title: string; location?: string; event_date: string; }>;
  todays_events?: Array<{ id: number; title: string; location?: string; event_date: string; }>;
  latest_issue?: { title: string; status: string; updated_at: string; } | null;
  latest_update?: { track: string; review_status: string; progress_score?: string | number | null; } | null;
  room?: { building_name?: string; room_name?: string; } | null;
  quick_stats?: { attendance_rate?: number; upcoming_events?: number; unresolved_issues?: number; reviewed_updates?: number; };
};
type QuranDuty = { id: number; page_from: string; page_to: string; assigned_for: string; status: 'assigned' | 'completed'; };
type Meeting = { id: number; title: string; meeting_at: string; location?: string; status: 'scheduled' | 'completed' | 'cancelled'; };
type DailyActivity = { id: number; title: string; start_time?: string; end_time?: string; schedule_date: string; repeat_mode?: string; presenter_name?: string; };

export default function Page() {
  const [data, setData] = useState<DashboardData>({});
  const [duties, setDuties] = useState<QuranDuty[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<{ type: 'event' | 'activity'; data: any } | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch('/profile/dashboard'),
      apiFetch('/profile/quran-assignments'),
      apiFetch('/profile/meetings'),
      apiFetch('/profile/schedule'),
    ])
      .then(([dashboardData, dutyData, meetingData, scheduleData]) => {
        setData(dashboardData);
        setDuties(dutyData);
        setMeetings(meetingData);
        setActivities(scheduleData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const nextDuty = useMemo(() => duties.find((d) => d.status === 'assigned') || null, [duties]);
  const nextMeeting = useMemo(() => meetings.find((m) => m.status === 'scheduled' && new Date(m.meeting_at).getTime() >= Date.now()) || null, [meetings]);
  const todaysActivities = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const dow = new Date().getDay();
    return activities.filter((a) => {
      if (a.repeat_mode === 'daily') return true;
      if (a.repeat_mode === 'weekly') return true; // weekly always shown for today
      return a.schedule_date === today;
    });
  }, [activities]);

  // 30-minute reminders via browser Notifications
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'denied') return;

    const schedule = (title: string, timeStr: string | undefined, prefix: string) => {
      if (!timeStr) return;
      const [h, m] = timeStr.split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return;
      const fire = new Date();
      fire.setHours(h, m - 30, 0, 0);
      const ms = fire.getTime() - Date.now();
      if (ms < 0 || ms > 86400000) return;
      return setTimeout(() => {
        new Notification(`${prefix}: ${title}`, { body: `Starting in 30 minutes at ${timeStr}` });
      }, ms);
    };

    let timers: ReturnType<typeof setTimeout>[] = [];

    const setup = () => {
      timers = [];
      (data.todays_events || []).forEach((e) => {
        const t = new Date(e.event_date);
        const timeStr = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
        const id = schedule(e.title, timeStr, 'Event');
        if (id) timers.push(id);
      });
      todaysActivities.forEach((a) => {
        const id = schedule(a.title, a.start_time, 'Activity');
        if (id) timers.push(id);
      });
    };

    if (Notification.permission === 'granted') {
      setup();
    } else {
      Notification.requestPermission().then((p) => { if (p === 'granted') setup(); });
    }

    return () => timers.forEach(clearTimeout);
  }, [data.todays_events, todaysActivities]);

  const stats = [
    { label: 'Attendance Rate', value: `${data.quick_stats?.attendance_rate || 0}%` },
    { label: 'Upcoming Events', value: data.quick_stats?.upcoming_events || 0 },
    { label: 'Open Issues', value: data.quick_stats?.unresolved_issues || 0 },
    { label: 'Reviewed Updates', value: data.quick_stats?.reviewed_updates || 0 },
  ];

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>See what happened last, what is coming next, and what duties are assigned to you.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}
      {loading ? <div className="empty-state"><p>Loading dashboard...</p></div> : null}

      {!loading ? (
        <>
          {/* Today's events + activities at top */}
          {((data.todays_events || []).length > 0 || todaysActivities.length > 0) ? (
            <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', marginBottom: '1rem' }}>
              {(data.todays_events || []).length > 0 ? (
                <section className="content-card" style={{ borderLeft: '3px solid var(--green)' }}>
                  <div className="content-card-header"><h2>Today's Events</h2></div>
                  <div style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                    {data.todays_events?.map((e) => (
                      <div key={e.id} onClick={() => setSelectedEvent({ type: 'event', data: e })} style={{ paddingBottom: '0.4rem', borderBottom: '1px solid #edf3ef', cursor: 'pointer' }}>
                        <strong>{e.title}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                          {new Date(e.event_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          {e.location ? ` · ${e.location}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
              {todaysActivities.length > 0 ? (
                <section className="content-card" style={{ borderLeft: '3px solid #c9a84c' }}>
                  <div className="content-card-header"><h2>Today's Activities</h2></div>
                  <div style={{ padding: '1rem', display: 'grid', gap: '0.5rem' }}>
                    {todaysActivities.map((a) => (
                      <div key={a.id} onClick={() => setSelectedEvent({ type: 'activity', data: a })} style={{ paddingBottom: '0.4rem', borderBottom: '1px solid #edf3ef', cursor: 'pointer' }}>
                        <strong>{a.title}</strong>
                        <div style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
                          {a.start_time ? `${a.start_time}${a.end_time ? ` – ${a.end_time}` : ''}` : ''}
                          {a.presenter_name ? ` · ${a.presenter_name}` : ''}
                          {a.repeat_mode === 'daily' ? ' · Daily' : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          ) : null}

          <div className="stats-grid">
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card"><div><h3>{stat.value}</h3><p>{stat.label}</p></div></div>
            ))}
          </div>

          <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
            <section className="content-card">
              <div className="content-card-header"><h2>Assigned Duties</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div>
                  <strong>Current Qur'an duty</strong>
                  <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {nextDuty ? `Read pages ${nextDuty.page_from} to ${nextDuty.page_to} by ${new Date(nextDuty.assigned_for).toLocaleDateString('en-GB')}` : 'No active Qur\'an duty.'}
                  </div>
                </div>
                <div>
                  <strong>Next meeting</strong>
                  <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {nextMeeting ? `${nextMeeting.title} · ${new Date(nextMeeting.meeting_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${nextMeeting.location ? ` · ${nextMeeting.location}` : ''}` : 'No scheduled meeting.'}
                  </div>
                </div>
                <div>
                  <strong>Room status</strong>
                  <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {data.room ? `${data.room.building_name} · ${data.room.room_name}` : 'No room assignment yet.'}
                  </div>
                </div>
              </div>
            </section>

            <section className="content-card">
              <div className="content-card-header"><h2>Last Activity</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div>
                  <strong>Last issue update</strong>
                  <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {data.latest_issue ? `${data.latest_issue.title} · ${data.latest_issue.status} · ${new Date(data.latest_issue.updated_at).toLocaleDateString('en-GB')}` : 'No issue activity yet.'}
                  </div>
                </div>
                <div>
                  <strong>Last progress review</strong>
                  <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                    {data.latest_update ? `${data.latest_update.track} · ${data.latest_update.review_status}${data.latest_update.progress_score != null ? ` · Score ${data.latest_update.progress_score}` : ''}` : 'No update reviews yet.'}
                  </div>
                </div>
              </div>
            </section>

            <section className="content-card" style={{ gridColumn: '1 / -1' }}>
              <div className="content-card-header"><h2>Upcoming Reminders</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                {(data.upcoming_events || []).length === 0 ? <p>No upcoming reminders right now.</p> : data.upcoming_events?.map((e) => (
                  <div key={e.id} style={{ borderBottom: '1px solid #edf3ef', paddingBottom: '0.75rem' }}>
                    <strong>{e.title}</strong>
                    <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {new Date(e.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      {e.location ? ` · ${e.location}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      ) : null}

      <Modal open={!!selectedEvent} onClose={() => setSelectedEvent(null)}>
        {selectedEvent?.type === 'event' ? (
          <div>
            <div className="section-outline-header">
              <div>
                <h2>{selectedEvent.data.title}</h2>
                <p>Event details</p>
              </div>
              <button type="button" className="btn-outline" onClick={() => setSelectedEvent(null)}>Close</button>
            </div>
            <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div className="review-meta-grid">
                <div><strong>Date</strong><span>{new Date(selectedEvent.data.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
                <div><strong>Location</strong><span>{selectedEvent.data.location || '—'}</span></div>
              </div>
            </div>
          </div>
        ) : selectedEvent?.type === 'activity' ? (
          <div>
            <div className="section-outline-header">
              <div>
                <h2>{selectedEvent.data.title}</h2>
                <p>Activity details</p>
              </div>
              <button type="button" className="btn-outline" onClick={() => setSelectedEvent(null)}>Close</button>
            </div>
            <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
              <div className="review-meta-grid">
                <div><strong>Time</strong><span>{selectedEvent.data.start_time ? `${selectedEvent.data.start_time}${selectedEvent.data.end_time ? ` – ${selectedEvent.data.end_time}` : ''}` : '—'}</span></div>
                <div><strong>Presenter</strong><span>{selectedEvent.data.presenter_name || '—'}</span></div>
                <div><strong>Repeat</strong><span>{selectedEvent.data.repeat_mode === 'daily' ? 'Daily' : selectedEvent.data.repeat_mode === 'weekly' ? 'Weekly' : 'Once'}</span></div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
