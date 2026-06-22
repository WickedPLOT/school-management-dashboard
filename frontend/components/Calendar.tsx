'use client';

import { useState, useMemo } from 'react';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  color: string; // hex color
  type: 'activity' | 'event';
  time?: string;
}

interface CalendarProps {
  events?: CalendarEvent[];
  onDayClick?: (date: string) => void;
}

export default function Calendar({ events = [], onDayClick }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const getEventsForDate = (day: number): CalendarEvent[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    onDayClick?.(dateStr);
  };

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1));
    setSelectedDate(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1));
    setSelectedDate(null);
  };

  const monthYear = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const dayEvents = selectedDate ? getEventsForDate(parseInt(selectedDate.split('-')[2])) : [];
  const selectedDateFormatted = selectedDate
    ? new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', padding: '1.5rem' }}>
      {/* Calendar Grid */}
      <div className="section-outline">
        <div className="section-outline-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <div>
            <h2>{monthYear}</h2>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={prevMonth} className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.75rem' }}>
              ← Prev
            </button>
            <button onClick={nextMonth} className="btn-outline" style={{ width: 'auto', padding: '0.5rem 0.75rem' }}>
              Next →
            </button>
          </div>
        </div>

        {/* Weekday headers */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '0.5rem',
            padding: '1rem',
            borderBottom: '1px solid var(--border)',
            marginBottom: '0.5rem',
          }}
        >
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div
              key={day}
              style={{
                textAlign: 'center',
                fontWeight: 600,
                fontSize: '0.875rem',
                color: 'var(--muted)',
                textTransform: 'uppercase',
              }}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem', padding: '0.5rem' }}>
          {/* Empty cells for days before month starts */}
          {Array(firstDayOfMonth)
            .fill(null)
            .map((_, i) => (
              <div key={`empty-${i}`} style={{ height: '120px' }} />
            ))}

          {/* Days of month */}
          {Array(daysInMonth)
            .fill(null)
            .map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDate(day);
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedDate === dateStr;
              const isToday = dateStr === new Date().toISOString().split('T')[0];

              return (
                <div
                  key={day}
                  onClick={() => handleDayClick(day)}
                  style={{
                    border: isSelected ? '2px solid #2563eb' : isToday ? '2px solid #10b981' : '1px solid var(--border)',
                    borderRadius: '0.5rem',
                    padding: '0.5rem',
                    minHeight: '120px',
                    cursor: 'pointer',
                    background: isSelected ? '#f0f4ff' : isToday ? '#f0fdf4' : 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.borderColor = '#3b82f6';
                      (e.currentTarget as HTMLElement).style.background = '#fafbfc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                      (e.currentTarget as HTMLElement).style.background = 'white';
                    }
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isToday ? '#10b981' : 'inherit' }}>
                    {day}
                  </div>
                  {dayEvents.slice(0, 2).map((event) => (
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
                        fontWeight: 500,
                      }}
                      title={event.title}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 500 }}>
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </div>

      {/* Sidebar with selected day details */}
      {selectedDate ? (
        <div className="section-outline">
          <div
            className="section-outline-header"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <div>
              <h2 style={{ fontSize: '1.125rem', marginBottom: '0.25rem' }}>{selectedDateFormatted}</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => setSelectedDate(null)}
              className="btn-outline"
              style={{ width: 'auto', padding: '0.5rem 0.75rem', fontSize: '0.875rem' }}
            >
              Clear
            </button>
          </div>

          {dayEvents.length === 0 ? (
            <div
              style={{
                padding: '2rem 1rem',
                textAlign: 'center',
                color: 'var(--muted)',
              }}
            >
              <p style={{ fontSize: '0.875rem' }}>No activities or events scheduled</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem' }}>
              {dayEvents.map((event) => (
                <div
                  key={event.id}
                  className="content-card"
                  style={{
                    padding: '0.875rem',
                    borderLeft: `4px solid ${event.color}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{event.title}</div>
                    {event.time && (
                      <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                        {event.time}
                      </div>
                    )}
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--muted)',
                        textTransform: 'uppercase',
                        fontWeight: 500,
                      }}
                    >
                      {event.type === 'activity' ? '📅 Activity' : '🎯 Event'}
                    </div>
                  </div>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '50%',
                      backgroundColor: event.color,
                      marginTop: '0.25rem',
                      flexShrink: 0,
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="section-outline" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '300px', textAlign: 'center' }}>
          <div style={{ color: 'var(--muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📅</div>
            <p>Click a date to see details</p>
          </div>
        </div>
      )}
    </div>
  );
}
