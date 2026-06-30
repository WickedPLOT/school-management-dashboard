'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import MoreDropdown from '@/components/MoreDropdown';

type User = { role: string; section?: 'brothers' | 'sisters' };
type Routine = { id: number; category: 'daily' | 'holiday' | 'personal' | 'activity'; title: string; description?: string; day_scope?: string; period?: string; start_time?: string; end_time?: string; section_scope: 'brothers' | 'sisters' | 'all'; sort_order: number; is_published: boolean; };

const EMPTY_ROUTINE = { category: 'daily', title: '', description: '', day_scope: '', period: '', start_time: '', end_time: '', section_scope: 'all', sort_order: 0, is_published: true };
const CATEGORY_LABELS = { daily: 'Daily Programs', holiday: 'Holiday Programs', personal: 'Personal Programs', activity: 'Activities' } as const;

function normalizeDayScope(value?: string) {
  const raw = (value || '').trim();
  if (!raw) return 'Every day';
  const compact = raw.toLowerCase().replace(/\s+/g, ' ');
  if (['monday, tuesday, wednesday, thursday, friday', 'monday to friday', 'mon-fri', 'weekdays'].includes(compact)) return 'Monday to Friday';
  return raw;
}

function routineGroupKey(item: Routine) {
  return [item.category, item.title.trim().toLowerCase(), (item.period || '').trim().toLowerCase(), item.start_time || '', item.end_time || '', item.section_scope].join('|');
}

export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineForm, setRoutineForm] = useState(EMPTY_ROUTINE);
  const [editingRoutineId, setEditingRoutineId] = useState<number | null>(null);
  const [showRoutineModal, setShowRoutineModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Routine | null>(null);
  const [attendanceTarget, setAttendanceTarget] = useState<Routine | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [attendanceRows, setAttendanceRows] = useState<Array<{ id: number; email: string; full_name?: string; attendance_status?: 'present' | 'absent' | 'excused' | 'late' }>>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);

  async function load() {
    try {
      const stored = localStorage.getItem('user');
      const parsed = stored ? JSON.parse(stored) : null;
      setUser(parsed);
      const routineData = await apiFetch('/admin/routines');
      setRoutines(routineData);
      if (parsed?.role !== 'super_admin') {
        setRoutineForm((current) => ({ ...current, section_scope: parsed?.section || 'brothers' }));
      }
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function openAttendance(item: Routine) {
    try {
      setAttendanceTarget(item);
      setError('');
      const data = await apiFetch(`/admin/routines/${item.id}/attendance?date=${attendanceDate}`);
      setAttendanceRows(data.roster);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load attendance data');
    }
  }

  async function setAttendanceStatus(userId: number, status: string) {
    setAttendanceRows((current) =>
      current.map((row) => (row.id === userId ? { ...row, attendance_status: status as any } : row))
    );
  }

  async function saveAttendance() {
    if (!attendanceTarget) return;
    setSavingAttendance(true);
    setError('');
    try {
      await apiFetch(`/admin/routines/${attendanceTarget.id}/attendance`, {
        method: 'PUT',
        body: JSON.stringify({
          date: attendanceDate,
          records: attendanceRows.map((row) => ({
            user_id: row.id,
            status: row.attendance_status || 'absent',
          })),
        }),
      });
      setAttendanceTarget(null);
      setSuccess('Attendance saved successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save attendance');
    } finally {
      setSavingAttendance(false);
    }
  }

  async function saveRoutine(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(''); setSuccess('');
    try {
      const payload = { ...routineForm, sort_order: Number(routineForm.sort_order) || 0 };
      if (editingRoutineId) {
        const updated = await apiFetch(`/admin/routines/${editingRoutineId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setRoutines((current) => current.map((item) => item.id === editingRoutineId ? updated : item));
        setSuccess('Routine item updated.');
      } else {
        const created = await apiFetch('/admin/routines', { method: 'POST', body: JSON.stringify(payload) });
        setRoutines((current) => [...current, created]);
        setSuccess('Routine item published.');
      }
      setEditingRoutineId(null);
      setShowRoutineModal(false);
      setRoutineForm({ ...EMPTY_ROUTINE, section_scope: user?.role === 'super_admin' ? 'all' : (user?.section || 'brothers') });
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally { setSaving(false); }
  }

  function editRoutine(item: Routine) {
    setEditingRoutineId(item.id);
    setShowRoutineModal(true);
    setRoutineForm({
      category: item.category,
      title: item.title || '',
      description: item.description || '',
      day_scope: item.day_scope || '',
      period: item.period || '',
      start_time: item.start_time || '',
      end_time: item.end_time || '',
      section_scope: item.section_scope,
      sort_order: item.sort_order || 0,
      is_published: item.is_published,
    });
  }

  function canManageRoutine(item: Routine) {
    return user?.role === 'super_admin' || item.section_scope === user?.section;
  }

  const groupedRoutines = useMemo(() => {
    const groups = new Map<string, Routine & { day_display: string; grouped_count: number }>();
    for (const item of routines) {
      const key = routineGroupKey(item);
      const day = normalizeDayScope(item.day_scope);
      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { ...item, day_display: day, grouped_count: 1 });
      } else {
        const days = new Set(existing.day_display.split(' / ').map((entry) => entry.trim()).filter(Boolean));
        days.add(day);
        groups.set(key, {
          ...existing,
          day_display: [...days].join(' / '),
          grouped_count: existing.grouped_count + 1,
          sort_order: Math.min(existing.sort_order, item.sort_order),
          is_published: existing.is_published || item.is_published,
        });
      }
    }
    return [...groups.values()].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title));
  }, [routines]);

  async function deleteRoutine() {
    if (!deleteTarget) return;
    try {
      // Find all routines in the same group and delete them all
      const targetKey = routineGroupKey(deleteTarget);
      const groupedIds = routines.filter(r => routineGroupKey(r) === targetKey).map(r => r.id);
      await Promise.all(groupedIds.map(id => apiFetch(`/admin/routines/${id}`, { method: 'DELETE' })));
      setRoutines((current) => current.filter((item) => !groupedIds.includes(item.id)));
      if (editingRoutineId && groupedIds.includes(editingRoutineId)) {
        setEditingRoutineId(null);
        setShowRoutineModal(false);
      }
      setDeleteTarget(null);
      setSuccess('Routine item deleted.');
    } catch (err) {
      setDeleteTarget(null);
      if (err instanceof Error) setError(err.message);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Routine Programs</h1>
        <p>Manage daily, holiday, personal, and activity routines students can see. Order controls the display sequence.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}
      {success ? <div className="success-msg">{success}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Published Routine List</h2>
            <p>Review and manage routine items without crowding daily activity planning.</p>
          </div>
          <button
            type="button"
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => {
              setEditingRoutineId(null);
              setRoutineForm({ ...EMPTY_ROUTINE, section_scope: user?.role === 'super_admin' ? 'all' : (user?.section || 'brothers') });
              setShowRoutineModal(true);
            }}
          >
            Add Routine
          </button>
        </div>
        {loading ? <div className="empty-state"><p>Loading routines...</p></div> : (
          <div className="panel-table-wrap">
            <table className="panel-table"><thead><tr><th>Program</th><th>When</th><th>Scope</th><th>Status</th><th>Action</th></tr></thead><tbody>{groupedRoutines.map((item) => <tr key={`${item.id}-${item.title}-${item.day_display}`}><td><strong>{item.title}</strong><div className="table-muted">{CATEGORY_LABELS[item.category]}{item.description ? ` · ${item.description}` : ''}{item.grouped_count > 1 ? ` · grouped ${item.grouped_count} entries` : ''}</div></td><td><strong>{item.day_display}</strong>{item.period ? ` · ${item.period}` : ''}{item.start_time ? ` · ${item.start_time}` : ''}{item.end_time ? ` - ${item.end_time}` : ''}</td><td style={{ textTransform: 'capitalize' }}>{item.section_scope}</td><td><span className={`badge badge-${item.is_published ? 'approved' : 'pending'}`}>{item.is_published ? 'published' : 'draft'}</span></td><td><MoreDropdown items={[
  { label: 'Attendance', onClick: () => openAttendance(item), color: '#1a5fa8' },
  { label: 'Edit', onClick: () => editRoutine(item), color: '#a8681a' },
  { label: 'Delete', onClick: () => setDeleteTarget(item), color: '#dc2626' },
]} /></td></tr>)}</tbody></table>
          </div>
        )}
      </section>

      <Modal open={showRoutineModal} onClose={() => setShowRoutineModal(false)} maxWidth="700px">
        <div className="routine-modal">
          <div className="section-outline-header">
            <div>
              <h2>{editingRoutineId ? 'Edit Routine' : 'Add Routine'}</h2>
              <p>Published routines appear in the student announcements page.</p>
            </div>
            <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setShowRoutineModal(false)}>Close</button>
          </div>
          <form onSubmit={saveRoutine} className="form-stack routine-modal-form">
            <div className="field-grid">
              <div className="field"><label>Category</label><select value={routineForm.category} onChange={(e) => setRoutineForm((c) => ({ ...c, category: e.target.value as Routine['category'] }))}><option value="daily">Daily Programs</option><option value="holiday">Holiday Programs</option><option value="personal">Personal Programs</option><option value="activity">Activities</option></select></div>
              <div className="field"><label>Day / Season</label><input value={routineForm.day_scope} onChange={(e) => setRoutineForm((c) => ({ ...c, day_scope: e.target.value }))} placeholder="Monday to Friday" /></div>
              <div className="field"><label>Period</label><input value={routineForm.period} onChange={(e) => setRoutineForm((c) => ({ ...c, period: e.target.value }))} placeholder="Morning" /></div>
            </div>
            <div className="field"><label>Title</label><input value={routineForm.title} onChange={(e) => setRoutineForm((c) => ({ ...c, title: e.target.value }))} placeholder="Fajir prayer" /></div>
            <div className="field"><label>Description</label><textarea rows={3} value={routineForm.description} onChange={(e) => setRoutineForm((c) => ({ ...c, description: e.target.value }))} placeholder="Optional details" /></div>
            <div className="field-grid">
              <div className="field"><label>Start Time</label><input type="time" value={routineForm.start_time} onChange={(e) => setRoutineForm((c) => ({ ...c, start_time: e.target.value }))} /></div>
              <div className="field"><label>End Time</label><input type="time" value={routineForm.end_time} onChange={(e) => setRoutineForm((c) => ({ ...c, end_time: e.target.value }))} /></div>
              <div className="field"><label>Display Order</label><input type="number" min="0" value={routineForm.sort_order} onChange={(e) => setRoutineForm((c) => ({ ...c, sort_order: Number(e.target.value) }))} /><span className="table-muted">Lower numbers appear first. Example: 1 before 10.</span></div>
            </div>
            <div className="field-grid">
              <div className="field"><label>Section</label>{user?.role === 'super_admin' ? <select value={routineForm.section_scope} onChange={(e) => setRoutineForm((c) => ({ ...c, section_scope: e.target.value as Routine['section_scope'] }))}><option value="all">All Sections</option><option value="brothers">Brothers</option><option value="sisters">Sisters</option></select> : <input value={user?.section === 'sisters' ? 'Sisters' : 'Brothers'} disabled />}</div>
              <div className="field"><label><input type="checkbox" checked={routineForm.is_published} onChange={(e) => setRoutineForm((c) => ({ ...c, is_published: e.target.checked }))} style={{ marginRight: 8 }} />Published</label></div>
            </div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{editingRoutineId ? 'Update Routine' : 'Add Routine'}</button>
              <button type="button" className="btn-outline" onClick={() => setShowRoutineModal(false)} style={{ width: 'auto' }}>Cancel</button>
            </div>
          </form>
        </div>
      </Modal>

      {deleteTarget ? (
        <ConfirmDialog title="Delete routine item?" message={`This will delete ${deleteTarget.title}.`} confirmLabel="Delete" tone="danger" onCancel={() => setDeleteTarget(null)} onConfirm={deleteRoutine} />
      ) : null}

      <Modal open={attendanceTarget !== null} onClose={() => setAttendanceTarget(null)} maxWidth="500px">
        <div className="section-outline-header">
          <div>
            <h2>Routine Attendance</h2>
            <p>{attendanceTarget?.title}</p>
          </div>
        </div>

        <div style={{ padding: '1rem' }}>
          <div className="field" style={{ marginBottom: '1rem' }}>
            <label>Date</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => {
                setAttendanceDate(e.target.value);
                if (attendanceTarget) {
                  apiFetch(`/admin/routines/${attendanceTarget.id}/attendance?date=${e.target.value}`)
                    .then((data) => setAttendanceRows(data.roster))
                    .catch((err) => setError(err.message));
                }
              }}
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            />
          </div>

          <div style={{ maxHeight: '50vh', overflow: 'auto' }}>
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={2} style={{ textAlign: 'center', color: 'var(--muted)' }}>
                      No students found
                    </td>
                  </tr>
                ) : (
                  attendanceRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.full_name || 'N/A'}</strong>
                        <div className="table-muted">{row.email}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                          <button type="button" className={`attend-present ${row.attendance_status === 'present' ? 'active' : ''}`} style={{ fontSize: '0.72rem', padding: '0.35rem 0.6rem', flex: 1 }} onClick={() => setAttendanceStatus(row.id, 'present')}>Present</button>
                          <button type="button" className={`attend-late ${row.attendance_status === 'late' ? 'active' : ''}`} style={{ fontSize: '0.72rem', padding: '0.35rem 0.6rem', flex: 1 }} onClick={() => setAttendanceStatus(row.id, 'late')}>Late</button>
                          <button type="button" className={`attend-absent ${row.attendance_status === 'absent' ? 'active' : ''}`} style={{ fontSize: '0.72rem', padding: '0.35rem 0.6rem', flex: 1 }} onClick={() => setAttendanceStatus(row.id, 'absent')}>Absent</button>
                          <button type="button" className={`attend-excused ${row.attendance_status === 'excused' ? 'active' : ''}`} style={{ fontSize: '0.72rem', padding: '0.35rem 0.6rem', flex: 1 }} onClick={() => setAttendanceStatus(row.id, 'excused')}>Excused</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button type="button" className="btn-primary" onClick={saveAttendance} disabled={savingAttendance} style={{ width: 'auto', paddingInline: '1.25rem' }}>
              {savingAttendance ? 'Saving...' : 'Save Attendance'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
