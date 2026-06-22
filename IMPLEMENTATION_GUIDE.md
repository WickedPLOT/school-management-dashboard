# COMPLETE IMPLEMENTATION GUIDE FOR REMAINING ISSUES

## Issue 1: Verify Book Upload/Manage is Now Working

### What was fixed:
- `frontend/lib/api.ts` - FormData handling
- `frontend/app/admin/books/upload/page.tsx` - Using apiFetch

### How to test:
1. Start backend: `cd backend && npm start`
2. Start frontend: `cd frontend && npm run dev`
3. Login as admin (brothers or sisters)
4. Go to Library > Upload Book
5. Upload a new PDF
6. Go to Library > Manage Books
7. **New book should appear** ✓

---

## Issue 2: Daily Activities Repeat Patterns

### Problem:
Activity shows on Monday, but missing on Tuesday = repeat logic incomplete

### Solution - Step 1: Update Database Schema

Add this to `database/schema.sql` after line 265 (after daily_schedules table):

```sql
-- Add columns for advanced repeat patterns
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS repeat_pattern VARCHAR(50) DEFAULT 'once' CHECK (repeat_pattern IN ('once', 'daily', 'weekdays', 'weekends', 'specific_days', 'week_only', 'month_only'));
ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS repeat_days JSONB;
-- repeat_days: [0,2,4] for Sun/Tues/Thurs (0-6 = Sun-Sat)

ALTER TABLE daily_schedules ADD COLUMN IF NOT EXISTS end_date DATE;
-- For week_only or month_only repeats
```

### Solution - Step 2: Update Controller

In `backend/src/controllers/residentLifeController.js`, find `createDailySchedule` function and update:

```javascript
async function createDailySchedule(req, res) {
  const { title, description, schedule_date, start_time, end_time, section_scope, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name } = req.body;
  
  if (!title?.trim()) return res.status(400).json({ error: 'title required' });
  if (!['brothers', 'sisters'].includes(section_scope)) return res.status(400).json({ error: 'Invalid section' });
  
  const validPatterns = ['once', 'daily', 'weekdays', 'weekends', 'specific_days', 'week_only', 'month_only'];
  if (repeat_pattern && !validPatterns.includes(repeat_pattern)) {
    return res.status(400).json({ error: 'Invalid repeat_pattern' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO daily_schedules (title, description, schedule_date, start_time, end_time, section_scope, repeat_mode, repeat_pattern, repeat_days, end_date, presenter_user_id, presenter_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        title.trim(),
        description?.trim() || null,
        schedule_date,
        start_time || null,
        end_time || null,
        section_scope,
        repeat_mode || 'once',
        repeat_pattern || 'once',
        repeat_days ? JSON.stringify(repeat_days) : null,
        end_date || null,
        presenter_user_id || null,
        presenter_name?.trim() || null,
        req.user.id
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
```

### Solution - Step 3: Update Frontend Form

In `frontend/app/admin/progress/schedule/page.tsx` or similar, update the form to include:

```tsx
// Add after repeat_mode select:
<div className="field">
  <label>Repeat Pattern</label>
  <select value={form.repeat_pattern} onChange={(e) => setForm(f => ({ ...f, repeat_pattern: e.target.value }))}>
    <option value="once">Once Only</option>
    <option value="daily">Daily</option>
    <option value="weekdays">Weekdays (Mon-Fri)</option>
    <option value="weekends">Weekends (Sat-Sun)</option>
    <option value="specific_days">Specific Days</option>
    <option value="week_only">One Week Only</option>
    <option value="month_only">Full Month</option>
  </select>
</div>

{form.repeat_pattern === 'specific_days' && (
  <div className="field">
    <label>Select Days</label>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, i) => (
        <label key={i} style={{ display: 'flex', gap: '0.25rem' }}>
          <input
            type="checkbox"
            checked={form.repeat_days?.includes(i) || false}
            onChange={(e) => {
              const days = form.repeat_days || [];
              if (e.target.checked) {
                setForm(f => ({ ...f, repeat_days: [...days, i] }));
              } else {
                setForm(f => ({ ...f, repeat_days: days.filter(d => d !== i) }));
              }
            }}
          />
          {day}
        </label>
      ))}
    </div>
  </div>
)}

{(form.repeat_pattern === 'week_only' || form.repeat_pattern === 'month_only') && (
  <div className="field">
    <label>End Date</label>
    <input
      type="date"
      value={form.end_date || ''}
      onChange={(e) => setForm(f => ({ ...f, end_date: e.target.value }))}
    />
  </div>
)}
```

---

## Issue 3: Implement Calendar Component

### Step 1: Create Calendar Component

Create `frontend/components/Calendar.tsx`:

```tsx
'use client';

import { useState } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  color: string;
  type: 'activity' | 'event';
}

interface CalendarProps {
  events?: CalendarEvent[];
  onDayClick?: (date: string) => void;
}

export default function Calendar({ events = [], onDayClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const getEventsForDate = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    onDayClick?.(dateStr);
  };

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dayEvents = selectedDate ? getEventsForDate(parseInt(selectedDate.split('-')[2])) : [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', padding: '1.5rem' }}>
      {/* Calendar */}
      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>{monthYear}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={prevMonth} className="btn-outline">←</button>
            <button onClick={nextMonth} className="btn-outline">→</button>
          </div>
        </div>

        {/* Weekday headers */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} style={{ textAlign: 'center', fontWeight: 600, fontSize: '0.875rem' }}>
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', padding: '1rem' }}>
          {/* Empty cells for days before month starts */}
          {Array(firstDayOfMonth).fill(null).map((_, i) => (
            <div key={`empty-${i}`} style={{ height: '100px' }} />
          ))}

          {/* Days of month */}
          {Array(daysInMonth).fill(null).map((_, i) => {
            const day = i + 1;
            const dayEvents = getEventsForDate(day);
            const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isSelected = selectedDate === dateStr;

            return (
              <div
                key={day}
                onClick={() => handleDayClick(day)}
                style={{
                  border: isSelected ? '2px solid #2563eb' : '1px solid var(--border)',
                  borderRadius: '0.5rem',
                  padding: '0.5rem',
                  minHeight: '100px',
                  cursor: 'pointer',
                  background: isSelected ? '#f0f4ff' : 'white',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{day}</div>
                {dayEvents.slice(0, 2).map(event => (
                  <div
                    key={event.id}
                    style={{
                      backgroundColor: event.color,
                      color: 'white',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.7rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
                    +{dayEvents.length - 2} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sidebar with selected day details */}
      {selectedDate && (
        <div className="section-outline">
          <div className="section-outline-header">
            <h2>{new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          </div>
          {dayEvents.length === 0 ? (
            <div className="empty-state">
              <p>No activities or events scheduled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              {dayEvents.map(event => (
                <div key={event.id} className="content-card" style={{ padding: '0.75rem', borderLeftWidth: '4px', borderLeftStyle: 'solid', borderLeftColor: event.color }}>
                  <div style={{ fontWeight: 600 }}>{event.title}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                    {event.type === 'activity' ? '📅 Activity' : '🎯 Event'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

### Step 2: Create Admin Calendar Page

Create `frontend/app/admin/calendar/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import Calendar from '@/components/Calendar';
import { apiFetch } from '@/lib/api';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  color: string;
  type: 'activity' | 'event';
}

export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadEvents() {
      try {
        // Get daily schedules
        const schedules = await apiFetch('/admin/daily-schedule');
        // Get events  
        const eventsList = await apiFetch('/admin/attendance/events');

        // Convert to calendar format
        const calendarEvents: CalendarEvent[] = [
          ...schedules.map((s: any, i: number) => ({
            id: `schedule-${s.id}`,
            title: s.title,
            date: s.schedule_date.split('T')[0],
            color: '#3b82f6', // Blue for activities
            type: 'activity' as const,
          })),
          ...eventsList.map((e: any, i: number) => ({
            id: `event-${e.id}`,
            title: e.title,
            date: e.event_date.split('T')[0],
            color: '#10b981', // Green for events
            type: 'event' as const,
          })),
        ];

        setEvents(calendarEvents);
      } catch (err) {
        console.error('Failed to load events:', err);
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, []);

  if (loading) {
    return <div className="section-shell"><p>Loading calendar...</p></div>;
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Calendar</h1>
        <p>View all activities and events color-coded by type</p>
      </div>
      <Calendar events={events} />
    </div>
  );
}
```

### Step 3: Create Student Calendar Page

Create `frontend/app/student/calendar/page.tsx` (same as admin but uses student endpoints):

```tsx
'use client';

import { useEffect, useState } from 'react';
import Calendar from '@/components/Calendar';
import { apiFetch } from '@/lib/api';

// Similar to admin calendar but with student endpoints
```

---

## Issue 4: Make Routines Clickable for Attendance

### Step 1: Update Routines Page

In `frontend/app/admin/routines/page.tsx`, add:

```tsx
async function markRoutineAttendance(routineId: number) {
  // Open modal with student list
  // POST to /admin/quran/assignments/:id/attendance
}

// Add button to each routine row:
<button onClick={() => markRoutineAttendance(routine.id)} className="btn-primary">
  Take Attendance
</button>
```

### Step 2: Implement Attendance Modal

Create attendance modal component that allows marking students present/absent/excused/late for the routine.

---

## Issue 5: Issue Management & Pie Charts

Create `frontend/app/admin/issues/page.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function IssuesPage() {
  const [issues, setIssues] = useState([]);
  const [stats, setStats] = useState({ pending: 0, inProgress: 0, resolved: 0 });

  useEffect(() => {
    async function load() {
      const data = await apiFetch('/admin/issues/reports');
      setIssues(data);
      
      // Calculate stats
      setStats({
        pending: data.filter((i: any) => i.status === 'pending').length,
        inProgress: data.filter((i: any) => i.status === 'in_progress').length,
        resolved: data.filter((i: any) => i.status === 'resolved').length,
      });
    }
    load();
  }, []);

  // Pie chart using SVG or library like Recharts
  return (
    <div className="section-shell">
      <h1>Issue Reports</h1>
      {/* Pie chart here */}
      {/* List of issues here */}
    </div>
  );
}
```

---

## Priority Order of Implementation

1. ✅ **DONE**: FormData fix for book uploads
2. **NEXT**: Daily activities repeat patterns (database + backend)
3. **THEN**: Calendar component
4. **THEN**: Routine attendance
5. **THEN**: Issue management & charts

---

## Testing Checklist

After each fix, test:

- [ ] Daily activity repeats correctly on specified days
- [ ] Calendar displays all activities and events
- [ ] Calendar colors different activity types
- [ ] Clicking routine opens attendance modal
- [ ] Attendance can be marked and saved
- [ ] Issue pie chart displays correct counts
- [ ] All filters work by section (brothers/sisters)

