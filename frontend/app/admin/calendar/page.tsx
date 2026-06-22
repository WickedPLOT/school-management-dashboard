'use client';

import { useEffect, useState } from 'react';
import Calendar, { CalendarEvent } from '@/components/Calendar';
import { apiFetch } from '@/lib/api';

interface DailySchedule {
  id: number;
  title: string;
  description?: string;
  schedule_date: string;
  start_time?: string;
  end_time?: string;
  section_scope: 'brothers' | 'sisters';
  repeat_pattern?: string;
}

interface AttendanceEvent {
  id: number;
  title: string;
  event_date: string;
  start_date?: string;
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        setError('');

        // Get daily schedules (activities)
        const schedules = await apiFetch('/admin/daily-schedule');

        // Get events
        const eventsList = await apiFetch('/admin/attendance/events');

        // Convert to calendar format
        const calendarEvents: CalendarEvent[] = [];

        // Add daily schedules as activities
        if (Array.isArray(schedules)) {
          for (const schedule of schedules) {
            const dateStr = schedule.schedule_date.split('T')[0];
            calendarEvents.push({
              id: `schedule-${schedule.id}`,
              title: schedule.title,
              date: dateStr,
              color: '#3b82f6', // Blue for activities
              type: 'activity',
              time: schedule.start_time ? schedule.start_time.substring(0, 5) : undefined,
            });
          }
        }

        // Add events
        if (Array.isArray(eventsList)) {
          for (const event of eventsList) {
            const dateStr = (event.event_date || event.start_date).split('T')[0];
            calendarEvents.push({
              id: `event-${event.id}`,
              title: event.title,
              date: dateStr,
              color: '#10b981', // Green for events
              type: 'event',
            });
          }
        }

        setEvents(calendarEvents);
      } catch (err) {
        console.error('Failed to load calendar events:', err);
        setError(err instanceof Error ? err.message : 'Failed to load events');
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  if (loading) {
    return (
      <div className="section-shell">
        <div className="page-header">
          <h1>Calendar</h1>
          <p>Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>View all activities and events color-coded by type</p>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center',
          marginBottom: '1rem',
          fontSize: '0.875rem',
          color: 'var(--muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#3b82f6', borderRadius: '0.25rem' }} />
          <span>Daily Activities</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: '#10b981', borderRadius: '0.25rem' }} />
          <span>Events</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ width: '16px', height: '16px', backgroundColor: 'white', border: '2px solid #10b981', borderRadius: '0.25rem' }} />
          <span>Today</span>
        </div>
      </div>

      <Calendar events={events} />
    </div>
  );
}
