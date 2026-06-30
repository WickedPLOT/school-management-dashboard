'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import MoreDropdown from '@/components/MoreDropdown';

type Student = { id: number; email: string; full_name?: string; section: 'brothers' | 'sisters' };
type User = { role: string; section?: 'brothers' | 'sisters' };
type ViewMode = 'activities' | 'meetings';
type DayPresenter = { day_of_week: number; presenter_user_id?: string; presenter_name?: string; };
type Schedule = { id: number; title: string; description?: string; schedule_date: string; start_time?: string; end_time?: string; section_scope: 'brothers' | 'sisters'; status: 'scheduled' | 'done' | 'cancelled'; repeat_mode?: 'once' | 'daily' | 'weekly'; repeat_pattern?: 'once' | 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'week_only' | 'month_only'; repeat_days?: number[]; end_date?: string; presenter_user_id?: number | null; presenter_name?: string | null; day_presenters?: DayPresenter[]; };
type Meeting = { id: number; user_id: number; title: string; agenda?: string; meeting_at: string; location?: string; status: 'scheduled' | 'completed' | 'cancelled'; outcome_note?: string; full_name?: string; email: string; };

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const EMPTY_DAY_PRESENTERS: DayPresenter[] = DAY_NAMES.map((_, i) => ({ day_of_week: i, presenter_user_id: '', presenter_name: '' }));
const EMPTY_SCHEDULE_FORM = { title: '', description: '', schedule_date: '', start_time: '', end_time: '', section_scope: 'brothers' as 'brothers' | 'sisters', repeat_mode: 'daily' as 'once' | 'daily' | 'weekly', repeat_pattern: 'once' as 'once' | 'daily' | 'weekdays' | 'weekends' | 'specific_days' | 'week_only' | 'month_only', repeat_days: [] as number[], end_date: '', presenter_user_id: '', presenter_name: '' };
const EMPTY_MEETING_FORM = { user_id: '', title: '', agenda: '', meeting_at: '', location: '' };

export default function Page() {
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get('student') || '';
  const [user, setUser] = useState<User | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeView, setActiveView] = useState<ViewMode>(selectedStudentId ? 'meetings' : 'activities');
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM);
  const [dayPresenters, setDayPresenters] = useState<DayPresenter[]>(EMPTY_DAY_PRESENTERS);
  const [meetingForm, setMeetingForm] = useState(EMPTY_MEETING_FORM);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showMeetingModal, setShowMeetingModal] = useState(Boolean(selectedStudentId));
  const [attendanceTarget, setAttendanceTarget] = useState<Schedule | null>(null);
  const [attendanceRows, setAttendanceRows] = useState<Array<{ id: number; email: string; full_name?: string; attendance_status?: 'present' | 'absent' | 'late' | 'excused' }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteScheduleTarget, setDeleteScheduleTarget] = useState<Schedule | null>(null);

  const [rosterTarget, setRosterTarget] = useState<Schedule | null>(null);
  const [rosterEntries, setRosterEntries] = useState<Array<{ roster_date: string; presenter_user_id: string; presenter_name: string; full_name?: string }>>([]);
  const [rosterSaving, setRosterSaving] = useState(false);

  async function load() {
    try {
      const stored = localStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : null;
      setUser(parsed);
      const [studentData, scheduleData, meetingData] = await Promise.all([
        apiFetch('/admin/students'),
        apiFetch('/admin/daily-schedule'),
        apiFetch('/admin/meetings'),
      ]);
      setStudents(studentData);
      setSchedules(scheduleData);
      setMeetings(meetingData);
      if (parsed?.role !== 'super_admin') {
        setScheduleForm((current) => ({ ...current, section_scope: parsed?.section || 'brothers' }));
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedStudentId && !meetingForm.user_id) {
      setActiveView('meetings');
      setShowMeetingModal(true);
      setMeetingForm((current) => ({ ...current, user_id: selectedStudentId }));
    }
  }, [selectedStudentId, meetingForm.user_id]);

  function resetScheduleForm() {
    setScheduleForm({ ...EMPTY_SCHEDULE_FORM, section_scope: user?.role === 'super_admin' ? 'brothers' : (user?.section || 'brothers') });
    setDayPresenters(EMPTY_DAY_PRESENTERS);
  }

  async function createSchedule(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload: any = { ...scheduleForm, presenter_user_id: scheduleForm.presenter_user_id ? Number(scheduleForm.presenter_user_id) : null };
      if (scheduleForm.repeat_mode === 'weekly') {
        payload.day_presenters = dayPresenters
          .filter((dp) => dp.presenter_user_id || dp.presenter_name)
          .map((dp) => ({ day_of_week: dp.day_of_week, presenter_user_id: dp.presenter_user_id ? Number(dp.presenter_user_id) : null, presenter_name: dp.presenter_name || null }));
      }
      const created = await apiFetch('/admin/daily-schedule', { method: 'POST', body: JSON.stringify(payload) });
      setSchedules((current) => [created, ...current]);
      resetScheduleForm();
      setShowScheduleModal(false);
      setSuccess('Daily activity scheduled.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally { setSaving(false); }
  }

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const created = await apiFetch('/admin/meetings', { method: 'POST', body: JSON.stringify({ ...meetingForm, user_id: Number(meetingForm.user_id) }) });
      setMeetings((current) => [created, ...current]);
      setMeetingForm(EMPTY_MEETING_FORM);
      setShowMeetingModal(false);
      setSuccess('Meeting scheduled.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally { setSaving(false); }
  }

  async function openAttendance(item: Schedule) {
    const data = await apiFetch(`/admin/daily-schedule/${item.id}/attendance`);
    setAttendanceTarget(item);
    setAttendanceRows(data.roster || []);
  }

  function setAttendanceStatus(userId: number, status: 'present' | 'absent' | 'late' | 'excused') {
    setAttendanceRows((current) => current.map((row) => row.id === userId ? { ...row, attendance_status: status } : row));
  }

  async function deleteSchedule() {
    if (!deleteScheduleTarget) return;
    try {
      await apiFetch(`/admin/daily-schedule/${deleteScheduleTarget.id}`, { method: 'DELETE' });
      setSchedules((current) => current.filter((s) => s.id !== deleteScheduleTarget.id));
      setDeleteScheduleTarget(null);
      setSuccess('Daily activity deleted.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  async function openRoster(item: Schedule) {
    setRosterTarget(item);
    try {
      const data = await apiFetch(`/admin/daily-schedule/${item.id}/roster`);
      // Generate 7 days starting from Monday of current week
      const today = new Date();
      const monday = new Date(today);
      monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const week: typeof rosterEntries = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const existing = data.find((r: any) => r.roster_date?.split('T')[0] === dateStr);
        week.push({ roster_date: dateStr, presenter_user_id: existing?.presenter_user_id?.toString() || '', presenter_name: existing?.presenter_name || '', full_name: existing?.full_name || '' });
      }
      setRosterEntries(week);
    } catch (err) { if (err instanceof Error) setError(err.message); }
  }

  async function saveRoster() {
    if (!rosterTarget) return;
    setRosterSaving(true);
    try {
      await apiFetch(`/admin/daily-schedule/${rosterTarget.id}/roster`, {
        method: 'PUT', body: JSON.stringify({ entries: rosterEntries.filter(e => e.presenter_user_id || e.presenter_name) })
      });
      setSuccess('Roster saved.');
      setRosterTarget(null);
    } catch (err) { if (err instanceof Error) setError(err.message); }
    finally { setRosterSaving(false); }
  }

  async function saveAttendance() {
    if (!attendanceTarget) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      await apiFetch(`/admin/daily-schedule/${attendanceTarget.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({ records: attendanceRows.map((row) => ({ user_id: row.id, status: row.attendance_status })).filter((row) => row.status) }),
      });
      setSuccess('Daily activity attendance saved.');
      setAttendanceTarget(null);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally { setSaving(false); }
  }

  async function updateMeetingStatus(item: Meeting, status: Meeting['status']) {
    try {
      const updated = await apiFetch(`/admin/meetings/${item.id}`, { method: 'PATCH', body: JSON.stringify({ ...item, status }) });
      setMeetings((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Announcements & Planning</h1>
        <p>Manage daily activities and one-on-one student meetings from one clean workspace.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}
      {success ? <div className="success-msg">{success}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>{activeView === 'activities' ? 'Daily Activities' : 'One-on-One Meetings'}</h2>
            <p>{activeView === 'activities' ? 'Publish the day plan so students know what is happening.' : 'Schedule and track direct student meetings.'}</p>
          </div>
          <div className="event-actions planning-actions">
            <button type="button" className={activeView === 'activities' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveView('activities')}>Daily Activities</button>
            <button type="button" className={activeView === 'meetings' ? 'btn-primary' : 'btn-outline'} onClick={() => setActiveView('meetings')}>One-on-One Meetings</button>
            {activeView === 'activities' ? (
              <button type="button" className="btn-primary" onClick={() => { resetScheduleForm(); setShowScheduleModal(true); }}>Add Daily Activity</button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => { setMeetingForm(EMPTY_MEETING_FORM); setShowMeetingModal(true); }}>Setup One-on-One Meeting</button>
            )}
          </div>
        </div>

        {loading ? <div className="empty-state"><p>Loading planning data...</p></div> : null}

        {!loading && activeView === 'activities' ? (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead><tr><th>Title</th><th>Date</th><th>Time</th><th>Section</th><th>Presenter</th><th>Repeat</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {schedules.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.title}</strong><div className="table-muted">{item.description || 'No description'}</div></td>
                    <td>{new Date(item.schedule_date).toLocaleDateString('en-GB')}</td>
                    <td>{item.start_time || '-'} {item.end_time ? `- ${item.end_time}` : ''}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.section_scope}</td>
                    <td>{item.repeat_mode === 'weekly'
                      ? (item.day_presenters?.find((dp: any) => dp.day_of_week === new Date().getDay())?.presenter_name || '—')
                      : (item.presenter_name || students.find((s) => s.id === item.presenter_user_id)?.full_name || '—')}</td>
                    <td>{item.repeat_mode === 'daily' ? 'Daily' : 'Once'}</td>
                    <td><span className={`badge badge-${item.status === 'done' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{item.status}</span></td>
                    <td><MoreDropdown items={[
                      { label: 'Roster', onClick: () => openRoster(item), color: '#0f766e' },
                      { label: 'Attendance', onClick: () => openAttendance(item), color: '#1a5fa8' },
                      { label: 'Delete', onClick: () => setDeleteScheduleTarget(item), color: '#dc2626' },
                    ]} /></td>
                  </tr>
                ))}
                {!schedules.length ? <tr><td colSpan={8}><div className="empty-state"><p>No daily activities added yet.</p></div></td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && activeView === 'meetings' ? (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead><tr><th>Student</th><th>Meeting</th><th>When</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {meetings.map((item) => (
                  <tr key={item.id}>
                    <td>{item.full_name || item.email}</td>
                    <td><strong>{item.title}</strong><div className="table-muted">{item.location || 'No location'}</div></td>
                    <td>{new Date(item.meeting_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className={`badge badge-${item.status === 'completed' ? 'approved' : item.status === 'cancelled' ? 'rejected' : 'pending'}`}>{item.status}</span></td>
                    <td>{item.status === 'scheduled' ? <MoreDropdown items={[
  { label: 'Complete', onClick: () => updateMeetingStatus(item, 'completed'), color: '#0f5132' },
  { label: 'Cancel', onClick: () => updateMeetingStatus(item, 'cancelled'), color: '#dc2626' },
]} /> : '-'}</td>
                  </tr>
                ))}
                {!meetings.length ? <tr><td colSpan={5}><div className="empty-state"><p>No one-on-one meetings scheduled yet.</p></div></td></tr> : null}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <Modal open={showScheduleModal} onClose={() => setShowScheduleModal(false)}>
        <div className="section-outline-header"><div><h2>Add Daily Activity</h2><p>Publish a scheduled activity for students.</p></div><button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setShowScheduleModal(false)}>Close</button></div>
        <form onSubmit={createSchedule} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field"><label>Title</label><input required value={scheduleForm.title} onChange={(e) => setScheduleForm((c) => ({ ...c, title: e.target.value }))} placeholder="Morning Cleaning" /></div>
          <div className="field"><label>Description</label><textarea rows={2} value={scheduleForm.description} onChange={(e) => setScheduleForm((c) => ({ ...c, description: e.target.value }))} placeholder="What students are expected to do" /></div>
          <div className="field-grid">
            <div className="field"><label>Date</label><input type="date" value={scheduleForm.schedule_date} onChange={(e) => setScheduleForm((c) => ({ ...c, schedule_date: e.target.value }))} /></div>
            <div className="field"><label>Start Time</label><input type="time" value={scheduleForm.start_time} onChange={(e) => setScheduleForm((c) => ({ ...c, start_time: e.target.value }))} /></div>
            <div className="field"><label>End Time</label><input type="time" value={scheduleForm.end_time} onChange={(e) => setScheduleForm((c) => ({ ...c, end_time: e.target.value }))} /></div>
          </div>
           <div className="field-grid">
             <div className="field">
               <label>Repeat</label>
               <select value={scheduleForm.repeat_mode} onChange={(e) => setScheduleForm((c) => ({ ...c, repeat_mode: e.target.value as 'once' | 'daily' | 'weekly' }))}>
                 <option value="once">Once</option>
                 <option value="daily">Daily</option>
                 <option value="weekly">Weekly (different presenter per day)</option>
               </select>
             </div>
             <div className="field">
               <label>Pattern</label>
               <select value={scheduleForm.repeat_pattern} onChange={(e) => setScheduleForm((c) => ({ ...c, repeat_pattern: e.target.value as any }))}>
                 <option value="once">Once Only</option>
                 <option value="daily">Daily</option>
                 <option value="weekdays">Weekdays (Mon-Fri)</option>
                 <option value="weekends">Weekends (Sat-Sun)</option>
                 <option value="specific_days">Specific Days</option>
                 <option value="week_only">One Week Only</option>
                 <option value="month_only">Full Month</option>
               </select>
             </div>
             <div className="field"><label>Section</label>{user?.role === 'super_admin' ? <select value={scheduleForm.section_scope} onChange={(e) => setScheduleForm((c) => ({ ...c, section_scope: e.target.value as 'brothers' | 'sisters' }))}><option value="brothers">Brothers</option><option value="sisters">Sisters</option></select> : <input value={user?.section === 'sisters' ? 'Sisters' : 'Brothers'} disabled />}</div>
           </div>

           {/* Specific days selection */}
           {scheduleForm.repeat_pattern === 'specific_days' && (
             <div className="field">
               <label>Select Days</label>
               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                 {DAY_NAMES.map((day, i) => (
                   <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                     <input
                       type="checkbox"
                       checked={scheduleForm.repeat_days?.includes(i) || false}
                       onChange={(e) => {
                         const days = scheduleForm.repeat_days || [];
                         if (e.target.checked) {
                           setScheduleForm((c) => ({ ...c, repeat_days: [...days, i] }));
                         } else {
                           setScheduleForm((c) => ({ ...c, repeat_days: days.filter((d) => d !== i) }));
                         }
                       }}
                     />
                     <span style={{ fontSize: '0.875rem' }}>{day.substring(0, 3)}</span>
                   </label>
                 ))}
               </div>
             </div>
           )}

           {/* End date for week_only or month_only */}
           {(scheduleForm.repeat_pattern === 'week_only' || scheduleForm.repeat_pattern === 'month_only') && (
             <div className="field">
               <label>End Date</label>
               <input
                 type="date"
                 value={scheduleForm.end_date}
                 onChange={(e) => setScheduleForm((c) => ({ ...c, end_date: e.target.value }))}
               />
             </div>
           )}

          {/* Default presenter (for once/daily) */}
          {scheduleForm.repeat_mode !== 'weekly' ? (
            <div className="field-grid">
              <div className="field"><label>Presenter (student)</label><select value={scheduleForm.presenter_user_id} onChange={(e) => setScheduleForm((c) => ({ ...c, presenter_user_id: e.target.value }))}><option value="">— None —</option>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}</select></div>
              <div className="field"><label>Presenter Name (override)</label><input value={scheduleForm.presenter_name} onChange={(e) => setScheduleForm((c) => ({ ...c, presenter_name: e.target.value }))} placeholder="Free-text name" /></div>
            </div>
          ) : null}

          {/* Per-day presenters for weekly */}
          {scheduleForm.repeat_mode === 'weekly' ? (
            <div>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)', marginBottom: '0.5rem' }}>Presenter per day of week</p>
              {DAY_NAMES.map((day, i) => (
                <div key={i} className="field-grid" style={{ marginBottom: '0.5rem', alignItems: 'center' }}>
                  <div style={{ minWidth: 90, fontSize: '0.85rem', fontWeight: 600 }}>{day}</div>
                  <div className="field" style={{ margin: 0 }}>
                    <select value={dayPresenters[i]?.presenter_user_id || ''} onChange={(e) => setDayPresenters((dp) => dp.map((d) => d.day_of_week === i ? { ...d, presenter_user_id: e.target.value } : d))}>
                      <option value="">— None —</option>
                      {students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <input placeholder="Or free-text name" value={dayPresenters[i]?.presenter_name || ''} onChange={(e) => setDayPresenters((dp) => dp.map((d) => d.day_of_week === i ? { ...d, presenter_name: e.target.value } : d))} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}><button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{saving ? 'Saving...' : 'Publish Activity'}</button><button type="button" className="btn-outline" onClick={() => setShowScheduleModal(false)} style={{ width: 'auto' }}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={showMeetingModal} onClose={() => setShowMeetingModal(false)}>
        <div className="section-outline-header"><div><h2>Setup One-on-One Meeting</h2><p>Schedule a direct meeting with a student.</p></div><button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setShowMeetingModal(false)}>Close</button></div>
        <form onSubmit={createMeeting} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field"><label>Student</label><select value={meetingForm.user_id} onChange={(e) => setMeetingForm((c) => ({ ...c, user_id: e.target.value }))}><option value="">Select student</option>{students.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}</select></div>
          <div className="field"><label>Meeting Title</label><input value={meetingForm.title} onChange={(e) => setMeetingForm((c) => ({ ...c, title: e.target.value }))} placeholder="Progress check-in" /></div>
          <div className="field"><label>Agenda</label><textarea rows={3} value={meetingForm.agenda} onChange={(e) => setMeetingForm((c) => ({ ...c, agenda: e.target.value }))} placeholder="Discuss attendance, academics, welfare" /></div>
          <div className="field-grid"><div className="field"><label>Date & Time</label><input type="datetime-local" value={meetingForm.meeting_at} onChange={(e) => setMeetingForm((c) => ({ ...c, meeting_at: e.target.value }))} /></div><div className="field"><label>Location</label><input value={meetingForm.location} onChange={(e) => setMeetingForm((c) => ({ ...c, location: e.target.value }))} placeholder="Office" /></div></div>
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}><button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{saving ? 'Saving...' : 'Schedule Meeting'}</button><button type="button" className="btn-outline" onClick={() => setShowMeetingModal(false)} style={{ width: 'auto' }}>Cancel</button></div>
        </form>
      </Modal>

      <Modal open={!!attendanceTarget} onClose={() => setAttendanceTarget(null)}>
        <div className="section-outline-header"><div><h2>Daily Activity Attendance</h2><p>{attendanceTarget?.title}</p></div></div>
        <div className="panel-table-wrap" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          <table className="panel-table">
            <thead><tr><th>Student</th><th>Status</th></tr></thead>
            <tbody>
              {attendanceRows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.full_name || row.email}</strong><div className="table-muted">{row.email}</div></td>
                  <td>
                    <div className="event-actions">
                      <button type="button" className={row.attendance_status === 'present' ? 'attend-present active' : 'attend-present'} onClick={() => setAttendanceStatus(row.id, 'present')}>Present</button>
                      <button type="button" className={row.attendance_status === 'late' ? 'attend-late active' : 'attend-late'} onClick={() => setAttendanceStatus(row.id, 'late')}>Late</button>
                      <button type="button" className={row.attendance_status === 'absent' ? 'attend-absent active' : 'attend-absent'} onClick={() => setAttendanceStatus(row.id, 'absent')}>Absent</button>
                      <button type="button" className={row.attendance_status === 'excused' ? 'attend-excused active' : 'attend-excused'} onClick={() => setAttendanceStatus(row.id, 'excused')}>Excused</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn-primary" onClick={saveAttendance} disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{saving ? 'Saving...' : 'Save Attendance'}</button>
        </div>
      </Modal>

      {deleteScheduleTarget ? (
        <ConfirmDialog title="Delete daily activity?" message={`This will permanently delete "${deleteScheduleTarget.title}".`} confirmLabel="Delete" tone="danger" onCancel={() => setDeleteScheduleTarget(null)} onConfirm={deleteSchedule} />
      ) : null}

      <Modal open={!!rosterTarget} onClose={() => setRosterTarget(null)} maxWidth="600px">
        <div className="section-outline-header">
          <div>
            <h2>Weekly Roster</h2>
            <p>{rosterTarget?.title} — assign a presenter for each day</p>
          </div>
        </div>
        <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
          {rosterEntries.map((entry, i) => {
            const dayName = new Date(entry.roster_date + 'T00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
            return (
              <div key={entry.roster_date} style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '0.5rem', alignItems: 'center' }}>
                <strong style={{ fontSize: '0.82rem' }}>{dayName}</strong>
                <select
                  value={entry.presenter_user_id}
                  onChange={(e) => {
                    const updated = [...rosterEntries];
                    const student = students.find(s => s.id === Number(e.target.value));
                    updated[i] = { ...entry, presenter_user_id: e.target.value, presenter_name: student?.full_name || '', full_name: student?.full_name || '' };
                    setRosterEntries(updated);
                  }}
                  style={{ fontSize: '0.82rem', padding: '0.4rem 0.5rem', borderRadius: '0.375rem', border: '1px solid var(--border)' }}
                >
                  <option value="">— No presenter —</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                </select>
              </div>
            );
          })}
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="button" className="btn-primary" onClick={saveRoster} disabled={rosterSaving} style={{ width: 'auto', padding: '0.5rem 1.25rem' }}>
              {rosterSaving ? 'Saving...' : 'Save Roster'}
            </button>
            <button type="button" className="btn-outline" onClick={() => setRosterTarget(null)} style={{ width: 'auto' }}>Cancel</button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
