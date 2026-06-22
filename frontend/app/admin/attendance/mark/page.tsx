'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type EventRow = {
  id: number;
  title: string;
  description?: string;
  location?: string;
  event_date: string;
  section_scope: string;
  marked_count: string;
  present_count: string;
  late_count: string;
  absent_count: string;
  excused_count: string;
};

type Settings = {
  default_event_section_scope: 'brothers' | 'sisters' | 'all';
};

const DEFAULT_FORM = {
  title: '',
  description: '',
  location: '',
  event_date: '',
  section_scope: 'brothers',
};

export default function Page() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ role: string; section?: 'brothers' | 'sisters' } | null>(null);
  const [sectionView, setSectionView] = useState<'all' | 'brothers' | 'sisters'>('all');

  async function load() {
    try {
      const [eventData, settings] = await Promise.all([
        apiFetch('/admin/attendance/events'),
        apiFetch('/admin/settings'),
      ]);
      setEvents(eventData);
      const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
      const parsedUser = storedUser ? JSON.parse(storedUser) : null;
      const nextScope = parsedUser?.role === 'super_admin'
        ? ((settings as Settings).default_event_section_scope || 'brothers')
        : (parsedUser?.section || 'brothers');
      setForm((current) => ({
        ...current,
        section_scope: nextScope,
      }));
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

  const filteredEvents = useMemo(() => {
    if (user?.role !== 'super_admin' || sectionView === 'all') return events;
    return events.filter((event) => event.section_scope === sectionView || event.section_scope === 'all');
  }, [events, sectionView, user?.role]);

  async function createEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await apiFetch('/admin/attendance/events', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setEvents((current) => [created, ...current]);
      setForm((current) => ({ ...DEFAULT_FORM, section_scope: current.section_scope }));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Attendance Register</h1>
        <p>Create events, then manage them from the calendar-based event manager.</p>
      </div>

      <div className="settings-grid">
        <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Event List</h2>
            <p>Use the event manager to update details, schedule, and attendance workflow</p>
          </div>
            <Link href="/admin/resources/events" className="btn-outline" style={{ padding: '0.5rem 0.8rem' }}>
              Open Events Calendar
            </Link>
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

          {loading ? (
            <div className="empty-state"><p>Loading events...</p></div>
          ) : filteredEvents.length === 0 ? (
            <div className="empty-state"><p>No events created yet.</p></div>
          ) : (
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Scope</th>
                    <th>Present</th>
                    <th>Late</th>
                    <th>Absent</th>
                    <th>Excused</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <strong>{event.title}</strong>
                        <div className="table-muted">{event.location || 'No location set'}</div>
                      </td>
                      <td>{new Date(event.event_date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td style={{ textTransform: 'capitalize' }}>{event.section_scope}</td>
                      <td>{event.present_count}</td>
                      <td>{event.late_count}</td>
                      <td>{event.absent_count}</td>
                      <td>{event.excused_count}</td>
                      <td>
                        <Link href={`/admin/attendance/events/${event.id}`} className="btn-outline" style={{ padding: '0.5rem 0.8rem' }}>
                          Open Register
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>Create Event</h2>
              <p>New events become available in the register immediately</p>
            </div>
          </div>
          <form onSubmit={createEvent} style={{ padding: '1rem' }} className="form-stack">
            <div className="field">
              <label>Event Title</label>
              <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Weekly Halaqa" />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={4} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Short description of the event" />
            </div>
            <div className="field">
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="Main Hall" />
            </div>
            <div className="field">
              <label>Event Date & Time</label>
              <input type="datetime-local" value={form.event_date} onChange={(e) => setForm((current) => ({ ...current, event_date: e.target.value }))} />
            </div>
            <div className="field">
              <label>Section Scope</label>
              {user?.role === 'super_admin' ? (
                <select value={form.section_scope} onChange={(e) => setForm((current) => ({ ...current, section_scope: e.target.value }))}>
                  <option value="brothers">{BROTHERS_CENTER_NAME}</option>
                  <option value="sisters">{SISTERS_CENTER_NAME}</option>
                  <option value="all">Both Sections</option>
                </select>
              ) : (
                <input value={user?.section === 'sisters' ? SISTERS_CENTER_NAME : BROTHERS_CENTER_NAME} disabled />
              )}
            </div>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
