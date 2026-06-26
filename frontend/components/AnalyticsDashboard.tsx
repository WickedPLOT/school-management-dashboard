'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type SectionKey = 'brothers' | 'sisters';
type SectionView = 'all' | SectionKey;

type Student = {
  id: number;
  email: string;
  section: SectionKey;
  full_name?: string;
  institution?: string;
  course?: string;
  nationality?: string;
  country?: string;
  county?: string;
  sub_county?: string;
};

type Issue = {
  id: number;
  title: string;
  section: SectionKey;
  status: 'pending' | 'inprogress' | 'resolved';
  category: string;
  full_name?: string;
  updated_at: string;
};

type UpdateItem = {
  id: number;
  track: 'academic' | 'religious' | 'activity';
  review_status: 'submitted' | 'reviewed';
  progress_score?: number | string | null;
  created_at: string;
  full_name?: string;
  email: string;
  section: SectionKey;
};

type AttendanceRow = {
  id: number;
  email: string;
  section: SectionKey;
  full_name?: string;
  marked_events: string;
  present_count: string;
  late_count: string;
  absent_count: string;
  excused_count: string;
  attendance_rate: string;
};

type Building = {
  id: number;
  name: string;
  section_scope: SectionKey;
  manager_name?: string;
  rooms: Array<{ id: number; name: string; capacity: number; occupied: number }>;
  unassigned: Array<{ id: number }>;
};

type EventItem = {
  id: number;
  title: string;
  event_date: string;
  section_scope: 'all' | SectionKey;
  location?: string;
};

type MessageHistoryItem = {
  id: number;
  audience: 'students' | 'parents' | 'both';
  channel: 'sms' | 'email' | 'both';
  section_scope: 'all' | SectionKey;
  status: 'sent' | 'partial' | 'failed';
  recipient_count?: number | string;
  success_count?: number | string;
  failure_count?: number | string;
  created_at: string;
};

type MessagingSummary = {
  summary: {
    total_students?: string | number;
    sms_students?: string | number;
    email_students?: string | number;
    sms_parents?: string | number;
    email_parents?: string | number;
  };
  history: MessageHistoryItem[];
};

type Focus = 'overview' | 'engagement' | 'occupancy' | 'issues';

function num(value: unknown) {
  return Number(value || 0);
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function formatDate(value?: string) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sectionLabel(section: SectionKey) {
  return section === 'brothers' ? BROTHERS_CENTER_NAME : SISTERS_CENTER_NAME;
}

function progressWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}


type ChartDatum = { label: string; value: number; color?: string };
const CHART_COLORS = ['#0f5132', '#c9a84c', '#2563eb', '#ea580c', '#7c3aed', '#0891b2', '#be123c'];

type HoverSlice = ChartDatum & { percent: number; total: number };

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const radians = ((angle - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
}

function describePieSlice(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z`;
}

function DonutChart({ title, data, totalLabel }: { title: string; data: ChartDatum[]; totalLabel?: string }) {
  const [hovered, setHovered] = useState<HoverSlice | null>(null);
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let angle = 0;

  return (
    <section className="content-card analytics-donut-card analytics-pie-card">
      <div className="content-card-header"><h2>{title}</h2></div>
      <div className="analytics-donut-body analytics-pie-body">
        <div className="analytics-donut-wrap analytics-pie-wrap" onMouseLeave={() => setHovered(null)}>
          <svg viewBox="0 0 128 128" role="img" aria-label={title}>
            <circle cx="64" cy="64" r="54" fill="#edf3ef" />
            {total > 0 ? data.map((item, index) => {
              const percent = item.value / total;
              const start = angle;
              const end = angle + percent * 360;
              angle = end;
              const color = item.color || CHART_COLORS[index % CHART_COLORS.length];
              return (
                <path
                  key={item.label}
                  className="analytics-pie-slice"
                  d={describePieSlice(64, 64, 54, start, Math.min(end, 359.999))}
                  fill={color}
                  stroke="#fff"
                  strokeWidth="1.5"
                  onMouseEnter={() => setHovered({ ...item, color, percent: Math.round(percent * 100), total })}
                  onFocus={() => setHovered({ ...item, color, percent: Math.round(percent * 100), total })}
                  tabIndex={0}
                >
                  <title>{`${item.label}: ${item.value} of ${total} ${totalLabel || 'total'} (${Math.round(percent * 100)}%)`}</title>
                </path>
              );
            }) : null}
          </svg>
          <div className="analytics-pie-total"><strong>{total}</strong><span>{totalLabel || 'Total'}</span></div>
          {hovered ? (
            <div className="analytics-pie-tooltip">
              <strong>{hovered.label}</strong>
              <span>{hovered.value} of {hovered.total} {totalLabel || 'total'}</span>
              <em>{hovered.percent}%</em>
            </div>
          ) : null}
        </div>
        <div className="analytics-donut-legend">
          {data.length ? data.map((item, index) => (
            <div key={item.label} className="analytics-donut-legend-row">
              <span style={{ background: item.color || CHART_COLORS[index % CHART_COLORS.length] }} />
              <p>{item.label}</p>
              <strong>{item.value}</strong>
            </div>
          )) : <p className="table-muted">No data yet.</p>}
        </div>
      </div>
    </section>
  );
}

function topDistribution<T>(items: T[], getLabel: (item: T) => string | undefined, fallback = 'Not set', limit = 5): ChartDatum[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    const raw = getLabel(item)?.trim();
    const label = raw || fallback;
    counts.set(label, (counts.get(label) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value], index) => ({ label, value, color: CHART_COLORS[index % CHART_COLORS.length] }));
}


type BarDatum = { label: string; value: number; meta?: string; color?: string };

function BarChartCard({ title, data, suffix = '', maxValue }: { title: string; data: BarDatum[]; suffix?: string; maxValue?: number }) {
  const max = maxValue || Math.max(...data.map((item) => item.value), 1);
  const ticks = [max, Math.round(max * 0.75), Math.round(max * 0.5), Math.round(max * 0.25), 0];
  return (
    <section className="content-card analytics-column-card">
      <div className="content-card-header"><h2>{title}</h2></div>
      {data.length ? (
        <div className="column-chart-shell">
          <div className="column-chart-y-axis">
            {ticks.map((tick) => <span key={tick}>{tick}{suffix}</span>)}
          </div>
          <div className="column-chart-plot">
            <div className="column-chart-grid" aria-hidden="true">
              {ticks.map((tick) => <span key={tick} />)}
            </div>
            <div className="column-chart-bars">
              {data.map((item, index) => {
                const height = max ? Math.max(4, Math.min(100, (item.value / max) * 100)) : 0;
                return (
                  <div key={item.label} className="column-chart-item">
                    <div className="column-chart-bar-wrap">
                      <div
                        className="column-chart-bar"
                        style={{ height: `${height}%`, background: item.color || CHART_COLORS[index % CHART_COLORS.length] }}
                        title={`${item.label}: ${item.value}${suffix}`}
                      />
                    </div>
                    <strong>{item.value}{suffix}</strong>
                    <span>{item.label}</span>
                    {item.meta ? <small>{item.meta}</small> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : <p className="table-muted" style={{ padding: '1rem' }}>No data yet.</p>}
    </section>
  );
}

export default function AnalyticsDashboard({
  focus,
  title,
  description,
  quickActions,
  todayPanel,
}: {
  focus: Focus;
  title: string;
  description: string;
  quickActions?: React.ReactNode;
  todayPanel?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ role: string; section: SectionKey } | null>(null);
  const [sectionView, setSectionView] = useState<SectionView>('all');
  const [students, setStudents] = useState<Student[]>([]);
  const [pending, setPending] = useState<Student[]>([]);
  const [rejected, setRejected] = useState<Student[]>([]);
  const [incomplete, setIncomplete] = useState<Student[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [messaging, setMessaging] = useState<MessagingSummary>({ summary: {}, history: [] });

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (parsed.role !== 'super_admin') setSectionView(parsed.section);
      }
    } catch {}

    Promise.all([
      apiFetch('/admin/students'),
      apiFetch('/admin/pending-users'),
      apiFetch('/admin/students/rejected'),
      apiFetch('/admin/profiles/incomplete'),
      apiFetch('/admin/issues/reports'),
      apiFetch('/admin/progress/updates'),
      apiFetch('/admin/attendance/overview'),
      apiFetch('/admin/accommodation/overview'),
      apiFetch('/admin/attendance/events'),
      apiFetch('/admin/messages/summary'),
    ])
      .then(([
        studentData,
        pendingData,
        rejectedData,
        incompleteData,
        issueData,
        updateData,
        attendanceData,
        buildingData,
        eventData,
        messagingData,
      ]) => {
        setStudents(studentData);
        setPending(pendingData);
        setRejected(rejectedData);
        setIncomplete(incompleteData);
        setIssues(issueData);
        setUpdates(updateData);
        setAttendance(attendanceData);
        setBuildings(buildingData);
        setEvents(eventData);
        setMessaging(messagingData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const activeSection = user?.role === 'super_admin' ? sectionView : (user?.section || 'brothers');

  const scopedStudents = useMemo(() => {
    if (activeSection === 'all') return students;
    return students.filter((item) => item.section === activeSection);
  }, [activeSection, students]);
  const scopedPending = useMemo(() => activeSection === 'all' ? pending : pending.filter((item) => item.section === activeSection), [activeSection, pending]);
  const scopedRejected = useMemo(() => activeSection === 'all' ? rejected : rejected.filter((item) => item.section === activeSection), [activeSection, rejected]);
  const scopedIncomplete = useMemo(() => activeSection === 'all' ? incomplete : incomplete.filter((item) => item.section === activeSection), [activeSection, incomplete]);
  const scopedIssues = useMemo(() => activeSection === 'all' ? issues : issues.filter((item) => item.section === activeSection), [activeSection, issues]);
  const scopedUpdates = useMemo(() => activeSection === 'all' ? updates : updates.filter((item) => item.section === activeSection), [activeSection, updates]);
  const scopedAttendance = useMemo(() => activeSection === 'all' ? attendance : attendance.filter((item) => item.section === activeSection), [activeSection, attendance]);
  const scopedBuildings = useMemo(() => activeSection === 'all' ? buildings : buildings.filter((item) => item.section_scope === activeSection), [activeSection, buildings]);
  const scopedEvents = useMemo(() => {
    if (activeSection === 'all') return events;
    return events.filter((item) => item.section_scope === activeSection || item.section_scope === 'all');
  }, [activeSection, events]);
  const scopedBroadcasts = useMemo(() => {
    if (activeSection === 'all') return messaging.history;
    return messaging.history.filter((item) => item.section_scope === activeSection || item.section_scope === 'all');
  }, [activeSection, messaging.history]);

  const capacity = scopedBuildings.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + num(room.capacity), 0), 0);
  const occupied = scopedBuildings.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + num(room.occupied), 0), 0);
  const unassigned = scopedBuildings.reduce((sum, building) => sum + building.unassigned.length, 0);
  const occupancyRate = pct(occupied, capacity);
  const openIssues = scopedIssues.filter((item) => item.status !== 'resolved');
  const resolvedIssues = scopedIssues.filter((item) => item.status === 'resolved');
  const resolutionRate = pct(resolvedIssues.length, scopedIssues.length);
  const reviewedUpdates = scopedUpdates.filter((item) => item.review_status === 'reviewed');
  const avgProgressScore = reviewedUpdates.length
    ? Math.round(reviewedUpdates.reduce((sum, item) => sum + num(item.progress_score), 0) / reviewedUpdates.length)
    : 0;
  const avgAttendance = scopedAttendance.length
    ? Math.round(scopedAttendance.reduce((sum, item) => sum + num(item.attendance_rate), 0) / scopedAttendance.length)
    : 0;
  const completionRate = pct(scopedStudents.length - scopedIncomplete.length, scopedStudents.length);
  const successfulBroadcasts = scopedBroadcasts.filter((item) => item.status === 'sent' || item.status === 'partial');
  const deliveredMessages = scopedBroadcasts.reduce((sum, item) => sum + num(item.success_count), 0);
  const totalRecipients = scopedBroadcasts.reduce((sum, item) => sum + num(item.recipient_count), 0);
  const latestIssues = [...scopedIssues].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 5);
  const latestBroadcasts = [...scopedBroadcasts].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).slice(0, 5);
  const topAttendance = [...scopedAttendance].sort((a, b) => num(b.attendance_rate) - num(a.attendance_rate)).slice(0, 5);
  const weakestAttendance = [...scopedAttendance].sort((a, b) => num(a.attendance_rate) - num(b.attendance_rate)).slice(0, 5);
  const updateTrackCounts = {
    academic: scopedUpdates.filter((item) => item.track === 'academic').length,
    religious: scopedUpdates.filter((item) => item.track === 'religious').length,
    activity: scopedUpdates.filter((item) => item.track === 'activity').length,
  };
  const sections = ['brothers', 'sisters'] as const;

  const sectionDistribution = topDistribution(scopedStudents, (item) => sectionLabel(item.section));
  const countryDistribution = topDistribution(scopedStudents, (item) => item.country || item.nationality, 'Country not set');
  const countyDistribution = topDistribution(scopedStudents, (item) => item.county, 'County not set');
  const courseDistribution = topDistribution(scopedStudents, (item) => item.course, 'Course not set', 7);
  const profileCompletionDistribution = [
    { label: 'Complete', value: Math.max(scopedStudents.length - scopedIncomplete.length, 0), color: '#0f5132' },
    { label: 'Incomplete', value: scopedIncomplete.length, color: '#c9a84c' },
  ];
  const occupancyDistribution = [
    { label: 'Occupied beds', value: occupied, color: '#0f5132' },
    { label: 'Available beds', value: Math.max(capacity - occupied, 0), color: '#c9a84c' },
    { label: 'Unassigned students', value: unassigned, color: '#be123c' },
  ].filter((item) => item.value > 0);
  const issueDistribution = [
    { label: 'Open', value: openIssues.length, color: '#be123c' },
    { label: 'Resolved', value: resolvedIssues.length, color: '#0f5132' },
  ];
  const progressDistribution = [
    { label: 'Academic', value: updateTrackCounts.academic, color: '#2563eb' },
    { label: 'Religious', value: updateTrackCounts.religious, color: '#0f5132' },
    { label: 'Activity', value: updateTrackCounts.activity, color: '#c9a84c' },
  ];
  const dormOccupancyBars = scopedBuildings.map((building) => {
    const buildingCapacity = building.rooms.reduce((sum, room) => sum + num(room.capacity), 0);
    const buildingOccupied = building.rooms.reduce((sum, room) => sum + num(room.occupied), 0);
    return {
      label: building.name,
      value: pct(buildingOccupied, buildingCapacity),
      meta: `${buildingOccupied}/${buildingCapacity} beds · ${sectionLabel(building.section_scope)}`,
      color: building.section_scope === 'sisters' ? '#be123c' : '#0f5132',
    };
  });
  const sectionComparisonBars = sections.map((section) => {
    const sectionStudents = students.filter((item) => item.section === section).length;
    const sectionAttendance = attendance.filter((item) => item.section === section);
    const sectionAvgAttendance = sectionAttendance.length
      ? Math.round(sectionAttendance.reduce((sum, item) => sum + num(item.attendance_rate), 0) / sectionAttendance.length)
      : 0;
    const sectionBuildings = buildings.filter((item) => item.section_scope === section);
    const sectionCapacity = sectionBuildings.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + num(room.capacity), 0), 0);
    const sectionOccupied = sectionBuildings.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + num(room.occupied), 0), 0);
    return {
      label: sectionLabel(section),
      value: sectionStudents,
      meta: `${sectionAvgAttendance}% attendance · ${pct(sectionOccupied, sectionCapacity)}% occupancy`,
      color: section === 'sisters' ? '#be123c' : '#0f5132',
    };
  });
  const attendanceBars = scopedAttendance
    .map((row) => ({ label: row.full_name || row.email, value: Math.round(num(row.attendance_rate)), meta: `${num(row.marked_events)} marked events`, color: num(row.attendance_rate) >= 75 ? '#0f5132' : '#c9a84c' }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
  const courseBars = courseDistribution.map((item) => ({ label: item.label, value: item.value, meta: `${item.value} student${item.value === 1 ? '' : 's'}`, color: item.color }));
  const progressBars = ['academic', 'religious', 'activity'].map((track, index) => ({
    label: track.charAt(0).toUpperCase() + track.slice(1),
    value: scopedUpdates.filter((item) => item.track === track).length,
    meta: `${scopedUpdates.filter((item) => item.track === track && item.review_status === 'reviewed').length} reviewed`,
    color: CHART_COLORS[index],
  }));

  const attendanceBreakdownBars = [
    { label: 'Present', value: scopedAttendance.reduce((s, r) => s + num(r.present_count), 0), color: '#16a34a' },
    { label: 'Late', value: scopedAttendance.reduce((s, r) => s + num(r.late_count), 0), color: '#f59e0b' },
    { label: 'Absent', value: scopedAttendance.reduce((s, r) => s + num(r.absent_count), 0), color: '#dc2626' },
    { label: 'Excused', value: scopedAttendance.reduce((s, r) => s + num(r.excused_count), 0), color: '#ca8a04' },
  ];

  const cards = [
    { label: 'Approved Students', value: scopedStudents.length },
    { label: 'Pending Approvals', value: scopedPending.length },
    { label: 'Attendance Average', value: `${avgAttendance}%` },
    { label: 'Occupancy Rate', value: `${occupancyRate}%` },
    { label: 'Open Issues', value: openIssues.length },
    { label: 'Delivered Messages', value: deliveredMessages },
  ];

  return (
    <div className="section-shell">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {quickActions ? quickActions : null}
      </div>

      <div className="section-outline" style={{ marginBottom: '1rem' }}>
        <div className="section-outline-header">
          <div>
            <h2>Analytics Filters</h2>
            <p>Live metrics from student accounts, attendance, issues, communication, and accommodation.</p>
          </div>
          <div className="event-actions">
            <Link href="/admin/analytics" className="btn-outline">Overview</Link>
            <Link href="/admin/analytics/engagement" className="btn-outline">Engagement</Link>
            <Link href="/admin/analytics/occupancy" className="btn-outline">Occupancy</Link>
            <Link href="/admin/analytics/issues" className="btn-outline">Issues</Link>
          </div>
        </div>
        {user?.role === 'super_admin' ? (
          <div className="legend-row" style={{ padding: '0 1rem 1rem' }}>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('all')}>
              All Centers
            </button>
            {sections.map((section) => (
              <button key={section} type="button" className="btn-outline" style={{ background: sectionView === section ? 'var(--green)' : 'white', color: sectionView === section ? 'white' : 'var(--green)' }} onClick={() => setSectionView(section)}>
                {sectionLabel(section)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {loading ? <div className="empty-state"><p>Loading analytics...</p></div> : null}
      {error ? <div className="error-msg">{error}</div> : null}

      {!loading && !error ? (
        <>
          {todayPanel ?? null}

          <div className="stats-grid">
            {cards.map((card) => (
              <div key={card.label} className="stat-card">
                <div>
                  <h3>{card.value}</h3>
                  <p>{card.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', marginTop: '1rem', alignItems: 'start' }}>
            {user?.role === 'super_admin' ? <BarChartCard title="Center Comparison" data={sectionComparisonBars} /> : null}
            <BarChartCard title="Most Popular Courses" data={courseBars} />
            <BarChartCard title="Dorm Occupancy" data={dormOccupancyBars} suffix="%" maxValue={100} />
            <BarChartCard title="Program Activity Volume" data={progressBars} />
            <BarChartCard title="Attendance Breakdown" data={attendanceBreakdownBars} />
            <DonutChart title="Center Split" data={sectionDistribution} totalLabel="Students" />
            <DonutChart title="Country / Nationality" data={countryDistribution} totalLabel="Students" />
            <DonutChart title="County Distribution" data={countyDistribution} totalLabel="Students" />
            <DonutChart title="Popular Courses" data={courseDistribution} totalLabel="Students" />
            <DonutChart title="Profile Completion" data={profileCompletionDistribution} totalLabel="Profiles" />
            <DonutChart title="Dorm Occupancy" data={occupancyDistribution} totalLabel="Beds" />
            <DonutChart title="Issue Status" data={issueDistribution} totalLabel="Issues" />
            <DonutChart title="Program Progress Tracks" data={progressDistribution} totalLabel="Updates" />
          </div>

          {(focus === 'overview' || focus === 'engagement') ? (
            <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
              <section className="content-card">
                <div className="content-card-header"><h2>Attendance Performance</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{avgAttendance}%</strong> average attendance rate</div>
                  <div><strong>{scopedEvents.length}</strong> events in scope</div>
                  <div><strong>{scopedAttendance.filter((row) => num(row.marked_events) > 0).length}</strong> students with attendance records</div>
                  {topAttendance.map((row) => (
                    <div key={row.id}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <span>{row.full_name || row.email}</span>
                        <strong>{num(row.attendance_rate)}%</strong>
                      </div>
                      <div style={{ height: 8, background: '#edf3ef', borderRadius: 999, marginTop: 6 }}>
                        <div style={{ width: progressWidth(num(row.attendance_rate)), height: '100%', background: 'var(--green)', borderRadius: 999 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="content-card">
                <div className="content-card-header"><h2>Progress Review</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{scopedUpdates.length}</strong> total submitted updates</div>
                  <div><strong>{reviewedUpdates.length}</strong> reviewed updates</div>
                  <div><strong>{avgProgressScore}</strong> average review score</div>
                  <div><strong>{updateTrackCounts.academic}</strong> academic • <strong>{updateTrackCounts.religious}</strong> religious • <strong>{updateTrackCounts.activity}</strong> activity</div>
                </div>
              </section>

              <section className="content-card">
                <div className="content-card-header"><h2>Communication Reach</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{successfulBroadcasts.length}</strong> successful broadcasts</div>
                  <div><strong>{deliveredMessages}</strong> successful deliveries</div>
                  <div><strong>{totalRecipients}</strong> target recipients</div>
                  <div><strong>{num(messaging.summary.sms_students)}</strong> student SMS contacts</div>
                  <div><strong>{num(messaging.summary.email_students)}</strong> student email contacts</div>
                </div>
              </section>
            </div>
          ) : null}

          {(focus === 'overview' || focus === 'occupancy') ? (
            <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
              <section className="content-card">
                <div className="content-card-header"><h2>Occupancy Snapshot</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{capacity}</strong> total bed capacity</div>
                  <div><strong>{occupied}</strong> occupied beds</div>
                  <div><strong>{unassigned}</strong> unassigned students</div>
                  <div><strong>{scopedBuildings.length}</strong> dorm buildings</div>
                  <div style={{ height: 10, background: '#edf3ef', borderRadius: 999 }}>
                    <div style={{ width: progressWidth(occupancyRate), height: '100%', background: 'var(--green)', borderRadius: 999 }} />
                  </div>
                </div>
              </section>

              <section className="content-card" style={{ gridColumn: focus === 'occupancy' ? '1 / -1' : undefined }}>
                <div className="content-card-header"><h2>Building Breakdown</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {scopedBuildings.map((building) => {
                    const buildingCapacity = building.rooms.reduce((sum, room) => sum + num(room.capacity), 0);
                    const buildingOccupied = building.rooms.reduce((sum, room) => sum + num(room.occupied), 0);
                    const buildingRate = pct(buildingOccupied, buildingCapacity);
                    return (
                      <div key={building.id} style={{ border: '1px solid var(--border)', borderRadius: '0.85rem', padding: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                          <strong>{building.name}</strong>
                          <span style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{building.section_scope}</span>
                        </div>
                        <div style={{ color: 'var(--muted)', marginTop: '0.4rem' }}>
                          {buildingOccupied}/{buildingCapacity} occupied • {building.rooms.length} rooms • {building.unassigned.length} unassigned
                        </div>
                        <div style={{ height: 8, background: '#edf3ef', borderRadius: 999, marginTop: 8 }}>
                          <div style={{ width: progressWidth(buildingRate), height: '100%', background: '#1e7a4b', borderRadius: 999 }} />
                        </div>
                      </div>
                    );
                  })}
                  {!scopedBuildings.length ? <p>No accommodation records in this scope yet.</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {(focus === 'overview' || focus === 'issues') ? (
            <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
              <section className="content-card">
                <div className="content-card-header"><h2>Issue Resolution</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{scopedIssues.length}</strong> total issues</div>
                  <div><strong>{openIssues.length}</strong> currently open</div>
                  <div><strong>{resolvedIssues.length}</strong> resolved</div>
                  <div><strong>{resolutionRate}%</strong> resolution rate</div>
                  <div style={{ height: 10, background: '#edf3ef', borderRadius: 999 }}>
                    <div style={{ width: progressWidth(resolutionRate), height: '100%', background: '#c9a84c', borderRadius: 999 }} />
                  </div>
                </div>
              </section>

              <section className="content-card">
                <div className="content-card-header"><h2>Recent Issue Queue</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {latestIssues.map((issue) => (
                    <div key={issue.id} style={{ borderBottom: '1px solid #edf3ef', paddingBottom: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <strong>{issue.title}</strong>
                        <span style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{issue.status}</span>
                      </div>
                      <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                        {issue.full_name || 'Unknown'} • {issue.category} • {formatDate(issue.updated_at)}
                      </div>
                    </div>
                  ))}
                  {!latestIssues.length ? <p>No issues found in this scope.</p> : null}
                </div>
              </section>
            </div>
          ) : null}

          {focus === 'overview' ? (
            <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
              {user?.role === 'super_admin' ? (
                <section className="content-card">
                  <div className="content-card-header"><h2>Center Comparison</h2></div>
                  <div style={{ padding: '1rem', display: 'grid', gap: '0.9rem' }}>
                    {sections.map((section) => {
                      const sectionStudents = students.filter((item) => item.section === section).length;
                      const sectionAttendance = attendance.filter((item) => item.section === section);
                      const sectionAvgAttendance = sectionAttendance.length
                        ? Math.round(sectionAttendance.reduce((sum, item) => sum + num(item.attendance_rate), 0) / sectionAttendance.length)
                        : 0;
                      const sectionIssues = issues.filter((item) => item.section === section && item.status !== 'resolved').length;
                      return (
                        <div key={section} style={{ border: '1px solid var(--border)', borderRadius: '0.85rem', padding: '0.85rem' }}>
                          <strong>{sectionLabel(section)}</strong>
                          <div style={{ color: 'var(--muted)', marginTop: '0.35rem' }}>
                            {sectionStudents} students • {sectionAvgAttendance}% attendance • {sectionIssues} open issues
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              <section className="content-card">
                <div className="content-card-header"><h2>Profile Health</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  <div><strong>{completionRate}%</strong> profile completion rate</div>
                  <div><strong>{scopedIncomplete.length}</strong> incomplete profiles</div>
                  <div><strong>{scopedRejected.length}</strong> rejected accounts</div>
                  <div><strong>{scopedPending.length}</strong> pending approvals</div>
                </div>
              </section>
            </div>
          ) : null}

          {focus === 'engagement' ? (
            <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', marginTop: '1rem' }}>
              <section className="content-card">
                <div className="content-card-header"><h2>Lowest Attendance</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {weakestAttendance.map((row) => (
                    <div key={row.id} style={{ borderBottom: '1px solid #edf3ef', paddingBottom: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <span>{row.full_name || row.email}</span>
                        <strong>{num(row.attendance_rate)}%</strong>
                      </div>
                      <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>{num(row.marked_events)} marked events</div>
                    </div>
                  ))}
                  {!weakestAttendance.length ? <p>No attendance records yet.</p> : null}
                </div>
              </section>

              <section className="content-card">
                <div className="content-card-header"><h2>Recent Broadcasts</h2></div>
                <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                  {latestBroadcasts.map((item) => (
                    <div key={item.id} style={{ borderBottom: '1px solid #edf3ef', paddingBottom: '0.65rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                        <strong>{item.channel}</strong>
                        <span style={{ textTransform: 'capitalize', color: 'var(--muted)' }}>{item.status}</span>
                      </div>
                      <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                        {item.audience} • {num(item.success_count)}/{num(item.recipient_count)} deliveries • {formatDate(item.created_at)}
                      </div>
                    </div>
                  ))}
                  {!latestBroadcasts.length ? <p>No broadcast history yet.</p> : null}
                </div>
              </section>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
