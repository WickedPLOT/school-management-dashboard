'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type QuranDuty = { id: number; page_from: string; page_to: string; assigned_for: string; status: 'assigned' | 'completed'; notes?: string; admin_note?: string; };
type Schedule = { id: number; title: string; description?: string; schedule_date: string; start_time?: string; end_time?: string; status: 'scheduled' | 'done' | 'cancelled'; repeat_mode?: 'once' | 'daily'; presenter_name?: string | null; presenter_user_id?: number | null; };
type Meeting = { id: number; title: string; agenda?: string; meeting_at: string; location?: string; status: 'scheduled' | 'completed' | 'cancelled'; outcome_note?: string; };
type Routine = { id: number; category: 'daily' | 'holiday' | 'personal' | 'activity'; title: string; description?: string; day_scope?: string; period?: string; start_time?: string; end_time?: string; sort_order: number; };
type TabKey = 'duties' | 'activities' | 'routines' | 'meetings' | 'schedule';
type ReminderSetting = { enabled: boolean; minutes_before: number; custom_time: string };

const CATEGORY_LABELS = { daily: 'Daily Programs', holiday: 'Holiday Programs', personal: 'Personal Programs', activity: 'Activities' } as const;
const DEFAULT_REMINDER: ReminderSetting = { enabled: true, minutes_before: 30, custom_time: '' };
const REMINDER_STORAGE_KEY = 'student-routine-reminders';

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function routineMeta(item: Routine) {
  return [item.day_scope || 'General', item.period, item.start_time ? `${item.start_time}${item.end_time ? ` - ${item.end_time}` : ''}` : null].filter(Boolean).join(' · ');
}

export default function Page() {
  const [duties, setDuties] = useState<QuranDuty[]>([]);
  const [schedule, setSchedule] = useState<Schedule[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [activeTab, setActiveTab] = useState<TabKey>('activities');
  const [reminders, setReminders] = useState<Record<number, ReminderSetting>>({});
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null);
  const [reminderDraft, setReminderDraft] = useState<ReminderSetting>(DEFAULT_REMINDER);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem(REMINDER_STORAGE_KEY);
      if (stored) setReminders(JSON.parse(stored));
    } catch {}

    Promise.all([
      apiFetch('/profile/quran-assignments'),
      apiFetch('/profile/schedule'),
      apiFetch('/profile/routines'),
      apiFetch('/profile/meetings'),
    ])
      .then(([dutyData, scheduleData, routineData, meetingData]) => {
        setDuties(dutyData);
        setSchedule(scheduleData);
        setRoutines(routineData);
        setMeetings(meetingData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const todayKey = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todaySchedule = schedule.filter((item) => item.schedule_date.slice(0, 10) === todayKey);
  const upcomingActivities = schedule.filter((item) => item.schedule_date.slice(0, 10) >= todayKey).slice(0, 8);
  const upcomingMeetings = meetings.filter((item) => item.status === 'scheduled' && new Date(item.meeting_at).getTime() >= Date.now());
  const activeDuties = duties.filter((item) => item.status === 'assigned');
  const routineGroups = (['daily', 'holiday', 'personal', 'activity'] as const).map((category) => ({ category, items: routines.filter((item) => item.category === category) }));

  const tabs: Array<{ key: TabKey; label: string; count: number }> = [
    { key: 'activities', label: "Today's Activities", count: todaySchedule.length },
    { key: 'duties', label: "Qur'an Duties", count: activeDuties.length },
    { key: 'routines', label: 'Routine Programs', count: routines.length },
    { key: 'meetings', label: 'Upcoming Meetings', count: upcomingMeetings.length },
    { key: 'schedule', label: 'Schedule', count: upcomingActivities.length },
  ];

  function openReminder(item: Routine) {
    const current = reminders[item.id] || DEFAULT_REMINDER;
    setSelectedRoutine(item);
    setReminderDraft({ ...current });
    setSuccess('');
  }

  function saveReminder() {
    if (!selectedRoutine) return;
    const next = { ...reminders, [selectedRoutine.id]: reminderDraft };
    setReminders(next);
    localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(next));
    setSelectedRoutine(null);
    setSuccess('Routine reminder saved.');
  }

  function reminderLabel(item: Routine) {
    const setting = reminders[item.id] || DEFAULT_REMINDER;
    if (!setting.enabled) return 'Reminder off';
    if (setting.custom_time) return `Reminder at ${setting.custom_time}`;
    return `${setting.minutes_before} min before`;
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Announcements</h1>
        <p>Use the buttons below to switch between duties, activities, routines, meetings, and schedule.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}
      {success ? <div className="success-msg">{success}</div> : null}
      {loading ? <div className="empty-state"><p>Loading announcements...</p></div> : null}

      {!loading ? (
        <section className="section-outline student-announcement-panel">
          <div className="student-section-tabs">
            {tabs.map((tab) => (
              <button key={tab.key} type="button" className={activeTab === tab.key ? 'active' : ''} onClick={() => setActiveTab(tab.key)}>
                <span>{tab.label}</span>
                <strong>{tab.count}</strong>
              </button>
            ))}
          </div>

          {activeTab === 'activities' ? (
            <div className="student-card-list">
              {todaySchedule.length === 0 ? <div className="empty-state"><p>No activities scheduled for today.</p></div> : todaySchedule.map((item) => (
                <article key={item.id} className="student-info-card">
                  <div><h3>{item.title}</h3><p>{item.start_time || 'Time not set'}{item.end_time ? ` - ${item.end_time}` : ''}</p><p className="table-muted">{item.repeat_mode === 'daily' ? 'Repeats daily' : 'One-time activity'}{item.presenter_name ? ` · Presenter: ${item.presenter_name}` : ''}</p></div>
                  <span className={`badge badge-${item.status === 'done' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{item.status}</span>
                  {item.description ? <p className="review-details">{item.description}</p> : null}
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'duties' ? (
            <div className="student-card-list">
              {activeDuties.length === 0 ? <div className="empty-state"><p>No active Qur’an duty assigned.</p></div> : activeDuties.map((item) => (
                <article key={item.id} className="student-info-card">
                  <div><h3>Pages {item.page_from} to {item.page_to}</h3><p>Due {formatDate(item.assigned_for)}</p></div>
                  <span className="badge badge-pending">assigned</span>
                  <p className="review-details">{item.notes || 'No extra note.'}</p>
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'routines' ? (
            <div className="routine-compact-grid">
              {routineGroups.map((group) => (
                <section key={group.category} className="routine-group-card">
                  <div className="routine-group-head">
                    <h2>{CATEGORY_LABELS[group.category]}</h2>
                    <span>{group.items.length}</span>
                  </div>
                  {group.items.length === 0 ? <p className="table-muted">No items published.</p> : group.items.map((item) => (
                    <article key={item.id} className="routine-list-item">
                      <div>
                        <h3>{item.title}</h3>
                        <p>{routineMeta(item)}</p>
                        {item.description ? <p>{item.description}</p> : null}
                        <span className="table-muted">{reminderLabel(item)}</span>
                      </div>
                      <button type="button" className="btn-outline" onClick={() => openReminder(item)}>Reminder</button>
                    </article>
                  ))}
                </section>
              ))}
            </div>
          ) : null}

          {activeTab === 'meetings' ? (
            <div className="student-card-list">
              {upcomingMeetings.length === 0 ? <div className="empty-state"><p>No upcoming meetings.</p></div> : upcomingMeetings.map((item) => (
                <article key={item.id} className="student-info-card">
                  <div><h3>{item.title}</h3><p>{formatDateTime(item.meeting_at)}{item.location ? ` · ${item.location}` : ''}</p></div>
                  <span className="badge badge-pending">scheduled</span>
                  <p className="review-details">{item.agenda || 'No agenda set.'}</p>
                </article>
              ))}
            </div>
          ) : null}

          {activeTab === 'schedule' ? (
            <div className="student-card-list">
              {upcomingActivities.length === 0 ? <div className="empty-state"><p>No upcoming activities in the schedule.</p></div> : upcomingActivities.map((item) => (
                <article key={item.id} className="student-info-card">
                  <div><h3>{item.title}</h3><p>{formatDate(item.schedule_date)}{item.start_time ? ` · ${item.start_time}` : ''}</p><p className="table-muted">{item.repeat_mode === 'daily' ? 'Repeats daily' : 'One-time activity'}{item.presenter_name ? ` · Presenter: ${item.presenter_name}` : ''}</p></div>
                  <span className={`badge badge-${item.status === 'done' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{item.status}</span>
                  {item.description ? <p className="review-details">{item.description}</p> : null}
                </article>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedRoutine ? (
        <div className="page-modal-backdrop" onClick={() => setSelectedRoutine(null)}>
          <div className="page-modal" onClick={(event) => event.stopPropagation()}>
            <div className="section-outline-header">
              <div><h2>Routine Reminder</h2><p>{selectedRoutine.title}</p></div>
              <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedRoutine(null)}>Close</button>
            </div>
            <div className="form-stack" style={{ padding: '1rem' }}>
              <div className="field">
                <label><input type="checkbox" checked={reminderDraft.enabled} onChange={(event) => setReminderDraft((current) => ({ ...current, enabled: event.target.checked }))} style={{ marginRight: 8 }} />Enable reminder</label>
              </div>
              <div className="field-grid">
                <div className="field"><label>Default reminder</label><select value={reminderDraft.minutes_before} onChange={(event) => setReminderDraft((current) => ({ ...current, minutes_before: Number(event.target.value), custom_time: '' }))}><option value={10}>10 minutes before</option><option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></div>
                <div className="field"><label>Or fixed time</label><input type="time" value={reminderDraft.custom_time} onChange={(event) => setReminderDraft((current) => ({ ...current, custom_time: event.target.value }))} /></div>
              </div>
              <p className="table-muted">Default is 30 minutes before the routine. Fixed time overrides the before-time setting.</p>
              <div className="event-actions"><button type="button" className="btn-primary" onClick={saveReminder}>Save Reminder</button><button type="button" className="btn-outline" onClick={() => setSelectedRoutine(null)}>Cancel</button></div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
