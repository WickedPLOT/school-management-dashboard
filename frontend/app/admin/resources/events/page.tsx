'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';
import Modal from '@/components/Modal';
import MoreDropdown from '@/components/MoreDropdown';

type EventScope = 'brothers' | 'sisters' | 'all';

type EventRow = {
  id: number;
  title: string;
  description?: string;
  location?: string;
  event_date: string;
  section_scope: EventScope;
  marked_count?: string;
  present_count?: string;
  late_count?: string;
  absent_count?: string;
  excused_count?: string;
};

type DayPresenter = { day_of_week: number; presenter_user_id?: string; presenter_name?: string; };

type DailySchedule = {
  id: number;
  title: string;
  description?: string;
  schedule_date: string;
  start_time?: string;
  end_time?: string;
  section_scope: 'brothers' | 'sisters';
  status: 'scheduled' | 'done' | 'cancelled';
  repeat_mode?: 'once' | 'daily' | 'weekly';
  presenter_user_id?: number | null;
  presenter_name?: string | null;
  day_presenters?: DayPresenter[];
};

type EventForm = {
  title: string;
  description: string;
  location: string;
  event_date: string;
  section_scope: EventScope;
};

type Settings = {
  default_event_section_scope: EventScope;
};

const DEFAULT_TIME = '18:00';

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeInput(dateString: string) {
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function buildDefaultForm(scope: EventScope, selectedDate: string): EventForm {
  return {
    title: '',
    description: '',
    location: '',
    event_date: `${selectedDate}T${DEFAULT_TIME}`,
    section_scope: scope,
  };
}

function normalizeEvent(event: EventRow): EventRow {
  return {
    ...event,
    marked_count: event.marked_count ?? '0',
    present_count: event.present_count ?? '0',
    late_count: event.late_count ?? '0',
    absent_count: event.absent_count ?? '0',
    excused_count: event.excused_count ?? '0',
  };
}

function toDateKey(eventDate: string) {
  return formatDateInput(new Date(eventDate));
}

function scheduleAppliesOnDate(schedule: DailySchedule, dateKey: string): boolean {
  if (schedule.status === 'cancelled') return false;
  const scheduleDateKey = formatDateInput(new Date(schedule.schedule_date));
  if (schedule.repeat_mode === 'once' || !schedule.repeat_mode) return scheduleDateKey === dateKey;
  if (schedule.repeat_mode === 'daily') return scheduleDateKey <= dateKey;
  if (schedule.repeat_mode === 'weekly') {
    const dayOfWeek = new Date(`${dateKey}T00:00`).getDay();
    return (schedule.day_presenters || []).some((dp) => dp.day_of_week === dayOfWeek);
  }
  return false;
}

export default function Page() {
  const searchParams = useSearchParams();
  const todayKey = useMemo(() => formatDateInput(new Date()), []);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [dailySchedules, setDailySchedules] = useState<DailySchedule[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [defaultScope, setDefaultScope] = useState<EventScope>('brothers');
  const [form, setForm] = useState<EventForm>(() => buildDefaultForm('brothers', todayKey));
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [user, setUser] = useState<{ role: string; section?: 'brothers' | 'sisters' } | null>(null);
  const [sectionView, setSectionView] = useState<'all' | 'brothers' | 'sisters'>('all');

  function startCreate(dateKey = selectedDate) {
    setEditingId(null);
    setError('');
    setSuccess('');
    const scope = user?.role === 'super_admin' ? defaultScope : (user?.section || defaultScope) as EventScope;
    setForm(buildDefaultForm(scope, dateKey));
  }

  function startEdit(event: EventRow) {
    setEditingId(event.id);
    setError('');
    setSuccess('');
    setForm({
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      event_date: formatDateTimeInput(event.event_date),
      section_scope: (user?.role === 'super_admin' ? event.section_scope : ((user?.section || event.section_scope) as EventScope)),
    });
  }

  async function load() {
    try {
      const [eventData, settings, scheduleData] = await Promise.all([
        apiFetch('/admin/attendance/events'),
        apiFetch('/admin/settings'),
        apiFetch('/admin/daily-schedule'),
      ]);

      const normalizedEvents = (eventData as EventRow[]).map(normalizeEvent);
      setDailySchedules(scheduleData as DailySchedule[]);
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const nextScope = parsedUser?.role === 'super_admin'
        ? ((settings as Settings).default_event_section_scope || 'brothers')
        : (parsedUser?.section || 'brothers');

      setEvents(normalizedEvents);
      setDefaultScope(nextScope);
      setForm((current) => current.title || current.description || current.location || editingId
        ? current
        : buildDefaultForm(nextScope, selectedDate));

      const queryEventId = Number(searchParams.get('event'));
      if (queryEventId) {
        const matched = normalizedEvents.find((event) => event.id === queryEventId);
        if (matched) {
          const date = new Date(matched.event_date);
          setSelectedDate(toDateKey(matched.event_date));
          setCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
          startEdit(matched);
        }
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    load();
  }, []);

  useEffect(() => {
    if (editingId !== null) return;
    setForm((current) => ({
      ...current,
      event_date: current.event_date || `${selectedDate}T${DEFAULT_TIME}`,
      section_scope: current.section_scope || defaultScope,
    }));
  }, [defaultScope, editingId, selectedDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (editingId) {
        const updated = normalizeEvent(await apiFetch(`/admin/attendance/events/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        }));
        setEvents((current) => current.map((event) => event.id === editingId ? { ...event, ...updated } : event));
        setSuccess('Event updated.');
      } else {
        const created = normalizeEvent(await apiFetch('/admin/attendance/events', {
          method: 'POST',
          body: JSON.stringify(form),
        }));
        setEvents((current) => [created, ...current]);
        setSuccess('Event created.');
        startCreate(toDateKey(created.event_date));
      }

      const eventDate = new Date(form.event_date);
      setSelectedDate(formatDateInput(eventDate));
      setCurrentMonth(new Date(eventDate.getFullYear(), eventDate.getMonth(), 1));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    setError('');
    setSuccess('');
    try {
      await apiFetch(`/admin/attendance/events/${id}`, { method: 'DELETE' });
      setEvents((current) => current.filter((event) => event.id !== id));
      if (editingId === id) startCreate(selectedDate);
      setSuccess('Event deleted.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  const visibleEvents = useMemo(() => {
    if (user?.role !== 'super_admin' || sectionView === 'all') return events;
    return events.filter((event) => event.section_scope === sectionView || event.section_scope === 'all');
  }, [events, sectionView, user?.role]);

  const visibleSchedules = useMemo(() => {
    if (user?.role !== 'super_admin' || sectionView === 'all') return dailySchedules;
    return dailySchedules.filter((s) => s.section_scope === sectionView);
  }, [dailySchedules, sectionView, user?.role]);

  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, EventRow[]>();
    for (const event of visibleEvents) {
      const key = toDateKey(event.event_date);
      const current = grouped.get(key) || [];
      current.push(event);
      grouped.set(key, current);
    }
    for (const item of grouped.values()) {
      item.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
    }
    return grouped;
  }, [visibleEvents]);

  const selectedSchedules = useMemo(() => {
    return visibleSchedules.filter((s) => scheduleAppliesOnDate(s, selectedDate));
  }, [visibleSchedules, selectedDate]);

  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const totalMonthEvents = useMemo(() => {
    return visibleEvents.filter((event) => {
      const date = new Date(event.event_date);
      return date.getFullYear() === currentMonth.getFullYear() && date.getMonth() === currentMonth.getMonth();
    }).length;
  }, [currentMonth, visibleEvents]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const startOffset = firstDay.getDay();
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const key = formatDateInput(date);
      const onceCount = visibleSchedules.filter(
        (s) => s.repeat_mode === 'once' && scheduleAppliesOnDate(s, key)
      ).length;
      return {
        key,
        date,
        isCurrentMonth: date.getMonth() === currentMonth.getMonth(),
        isToday: key === todayKey,
        count: (eventsByDate.get(key) || []).length + onceCount,
      };
    });
  }, [currentMonth, eventsByDate, visibleSchedules, todayKey]);

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Events Calendar</h1>
        <p>Create, edit, delete, and manage centre events from one calendar view.</p>
      </div>

      <div className="events-layout">
        <section className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>Calendar</h2>
              <p>Pick a day to review the schedule and prepare new events.</p>
            </div>
            <button type="button" className="btn-outline" onClick={() => startCreate(selectedDate)}>
              New Event
            </button>
          </div>

          {user?.role === 'super_admin' ? (
            <div className="legend-row" style={{ padding: '0 1rem 1rem' }}>
              <button type="button" className="btn-outline" style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('all')}>
                Both Sections
              </button>
              <button type="button" className="btn-outline" style={{ background: sectionView === 'brothers' ? 'var(--green)' : 'white', color: sectionView === 'brothers' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('brothers')}>
                {BROTHERS_CENTER_NAME}
              </button>
              <button type="button" className="btn-outline" style={{ background: sectionView === 'sisters' ? 'var(--green)' : 'white', color: sectionView === 'sisters' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('sisters')}>
                {SISTERS_CENTER_NAME}
              </button>
            </div>
          ) : null}

          <div className="events-calendar">
            <div className="calendar-toolbar">
              <button type="button" className="btn-outline" onClick={() => setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>
                Previous
              </button>
              <div className="calendar-title">
                <strong>{currentMonth.toLocaleString('en-GB', { month: 'long', year: 'numeric' })}</strong>
                <span>{totalMonthEvents} event{totalMonthEvents === 1 ? '' : 's'} this month</span>
              </div>
              <button type="button" className="btn-outline" onClick={() => setCurrentMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>
                Next
              </button>
            </div>

            <div className="calendar-weekdays">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>

            <div className="calendar-grid">
              {calendarDays.map((day) => (
                <button
                  key={day.key}
                  type="button"
                  className={[
                    'calendar-day',
                    day.isCurrentMonth ? '' : 'muted',
                    day.isToday ? 'today' : '',
                    selectedDate === day.key ? 'selected' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => {
                    setSelectedDate(day.key);
                    if (editingId === null) startCreate(day.key);
                  }}
                >
                  <span className="calendar-day-number">{day.date.getDate()}</span>
                  <span className="calendar-day-meta">
                    {day.count > 0 ? `${day.count} event${day.count === 1 ? '' : 's'}` : 'No events'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className="events-sidebar">
          <section className="section-outline">
            <div className="section-outline-header">
              <div>
                <h2>{new Date(`${selectedDate}T00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h2>
                <p>Events & daily activities for the selected day.</p>
              </div>
              <Link href="/admin/attendance/records" className="btn-outline">
                Attendance Summary
              </Link>
            </div>

            {loading ? (
              <div className="empty-state"><p>Loading...</p></div>
            ) : selectedEvents.length === 0 && selectedSchedules.length === 0 ? (
              <div className="empty-state"><p>Nothing scheduled for this day.</p></div>
            ) : (
              <div className="event-list">
                {selectedSchedules.map((s) => (
                  <article key={`s-${s.id}`} className="event-card schedule-card">
                    <div className="event-card-head">
                      <div>
                        <h3>{s.title}</h3>
                        <p>{s.start_time || ''}{s.end_time ? ` - ${s.end_time}` : ''}</p>
                      </div>
                      <span className="badge badge-pending">{s.repeat_mode === 'daily' ? 'Daily' : s.repeat_mode === 'weekly' ? 'Weekly' : 'Once'}</span>
                    </div>
                    <div className="event-card-body">
                      <p>{s.description || 'No description'}</p>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>{s.section_scope} · {s.presenter_name || 'No presenter'}</p>
                    </div>
                    <div className="event-actions">
                      <Link href={`/admin/announcements`} className="btn-outline" style={{ width: 'auto' }}>
                        Manage
                      </Link>
                    </div>
                  </article>
                ))}
                {selectedEvents.map((event) => (
                  <article key={event.id} className={`event-card ${editingId === event.id ? 'active' : ''}`}>
                    <div className="event-card-head">
                      <div>
                        <h3>{event.title}</h3>
                        <p>{new Date(event.event_date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                      <span className={`event-scope scope-${event.section_scope}`}>{event.section_scope}</span>
                    </div>
                    <div className="event-card-body">
                      <p>{event.location || 'No location set'}</p>
                      <p>{event.description || 'No description added yet.'}</p>
                    </div>
                    <div className="event-stats">
                      <span>Present {event.present_count}</span>
                      <span>Late {event.late_count}</span>
                      <span>Absent {event.absent_count}</span>
                      <span>Excused {event.excused_count}</span>
                    </div>
                    <MoreDropdown items={[
                      { label: 'Edit', onClick: () => startEdit(event), color: '#1a5fa8' },
                      { label: 'Register', onClick: () => { window.location.href = `/admin/attendance/events/${event.id}`; }, color: '#0f5132' },
                      { label: deletingId === event.id ? 'Deleting...' : 'Delete', onClick: () => handleDelete(event.id), color: '#dc2626' },
                    ]} />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="section-outline">
            <div className="section-outline-header">
              <div>
                <h2>{editingId ? 'Edit Event' : 'Create Event'}</h2>
                <p>{editingId ? 'Update the selected event details.' : 'The selected day is used as the default date.'}</p>
              </div>
              {editingId ? (
                <button type="button" className="btn-outline" onClick={() => startCreate(selectedDate)}>
                  Cancel Edit
                </button>
              ) : null}
            </div>

            <form onSubmit={handleSubmit} className="form-stack events-form">
              <div className="field">
                <label>Event Title</label>
                <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Monthly mentorship circle" />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea rows={4} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Agenda or important notes" />
              </div>
              <div className="field-grid">
                <div className="field">
                  <label>Location</label>
                  <input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="Main hall" />
                </div>
                <div className="field">
                  <label>Section Scope</label>
                  {user?.role === 'super_admin' ? (
                    <select value={form.section_scope} onChange={(e) => setForm((current) => ({ ...current, section_scope: e.target.value as EventScope }))}>
                      <option value="brothers">{BROTHERS_CENTER_NAME}</option>
                      <option value="sisters">{SISTERS_CENTER_NAME}</option>
                      <option value="all">Both Sections</option>
                    </select>
                  ) : (
                    <input value={user?.section === 'sisters' ? SISTERS_CENTER_NAME : BROTHERS_CENTER_NAME} disabled />
                  )}
                </div>
              </div>
              <div className="field">
                <label>Date & Time</label>
                <input type="datetime-local" value={form.event_date} onChange={(e) => setForm((current) => ({ ...current, event_date: e.target.value }))} />
              </div>

              {error ? <div className="error-msg">{error}</div> : null}
              {success ? <div className="success-msg">{success}</div> : null}

              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? (editingId ? 'Saving...' : 'Creating...') : (editingId ? 'Save Changes' : 'Create Event')}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
