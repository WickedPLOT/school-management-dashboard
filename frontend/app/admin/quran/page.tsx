'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import Modal from '@/components/Modal';
import MoreDropdown from '@/components/MoreDropdown';

type Student = {
  id: number;
  email: string;
  full_name?: string;
  section: 'brothers' | 'sisters';
};

type Assignment = {
  id: number;
  user_id: number;
  page_from: string;
  page_to: string;
  assigned_for: string;
  notes?: string;
  admin_note?: string;
  status: 'assigned' | 'completed';
  full_name?: string;
  email: string;
  section: 'brothers' | 'sisters';
  completed_at?: string;
};

export default function Page() {
  const searchParams = useSearchParams();
  const selectedStudentId = searchParams.get('student') || '';
  const [students, setStudents] = useState<Student[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [form, setForm] = useState({ audience: 'one', user_id: '', page_from: '', page_to: '', assigned_for: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showModal, setShowModal] = useState(false);

  async function load() {
    try {
      const [studentData, assignmentData] = await Promise.all([
        apiFetch('/admin/students'),
        apiFetch('/admin/quran/assignments'),
      ]);
      setStudents(studentData);
      setAssignments(assignmentData);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selectedStudentId) {
      setForm((current) => ({ ...current, audience: 'one', user_id: selectedStudentId }));
    }
  }, [selectedStudentId, form.user_id]);

  const summary = useMemo(() => ({
    total: assignments.length,
    pending: assignments.filter((item) => item.status === 'assigned').length,
    completed: assignments.filter((item) => item.status === 'completed').length,
  }), [assignments]);

  async function createAssignment(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await apiFetch('/admin/quran/assignments', {
        method: 'POST',
        body: JSON.stringify({ ...form, user_id: form.audience === 'all' ? null : Number(form.user_id) }),
      });
      const createdList = Array.isArray(created) ? created : [created];
      setAssignments((current) => [...createdList, ...current]);
      setForm({ audience: 'one', user_id: '', page_from: '', page_to: '', assigned_for: '', notes: '' });
      setShowModal(false);
      setSuccess(form.audience === 'all' ? 'Qur\'an duty assigned to all students.' : 'Qur\'an duty assigned.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function markComplete(item: Assignment) {
    setError('');
    setSuccess('');
    try {
      const updated = await apiFetch(`/admin/quran/assignments/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed', admin_note: item.admin_note || '' }),
      });
      setAssignments((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry));
      setSuccess('Qur\'an duty marked complete.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  function openAssignModal() {
    setForm({ audience: 'one', user_id: '', page_from: '', page_to: '', assigned_for: '', notes: '' });
    setError('');
    setShowModal(true);
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Qur&rsquo;an Duties</h1>
        <p>Assign page ranges to students and mark completion when they finish the reading.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><h3>{summary.total}</h3><p>Total assignments</p></div></div>
        <div className="stat-card"><div><h3>{summary.pending}</h3><p>Pending reading</p></div></div>
        <div className="stat-card"><div><h3>{summary.completed}</h3><p>Completed</p></div></div>
      </div>

      {error && !showModal ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
      {success && !showModal ? <div className="success-msg" style={{ margin: '1rem' }}>{success}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Assigned Duties</h2>
            <p>Track assigned reading and mark completion.</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAssignModal} style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            + Assign Reading
          </button>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading assignments...</p></div>
        ) : assignments.length === 0 ? (
          <div className="empty-state"><p>No duties assigned yet.</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Pages</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.full_name || item.email}</strong>
                      <div className="table-muted">{item.email}</div>
                    </td>
                    <td>{item.page_from} → {item.page_to}</td>
                    <td>{new Date(item.assigned_for).toLocaleDateString('en-GB')}</td>
                    <td>
                      <span className={`badge badge-${item.status === 'completed' ? 'approved' : 'pending'}`}>
                        {item.status}
                      </span>
                    </td>
                    <td>
                      {item.status === 'completed' ? (
                        'Done'
                      ) : (
                        <button type="button" className="btn-outline" onClick={() => markComplete(item)}>
                          Mark Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={showModal} onClose={() => setShowModal(false)}>
        <div className="section-outline-header">
          <div>
            <h2>Assign Reading</h2>
            <p>Set a student&rsquo;s page range and due date.</p>
          </div>
          <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setShowModal(false)}>Close</button>
        </div>
        <form onSubmit={createAssignment} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field">
            <label>Audience</label>
            <select value={form.audience} onChange={(e) => setForm((current) => ({ ...current, audience: e.target.value, user_id: e.target.value === 'all' ? '' : current.user_id }))}>
              <option value="one">Individual student</option>
              <option value="all">All students</option>
            </select>
          </div>
          {form.audience === 'one' ? (
            <div className="field">
              <label>Student</label>
              <select value={form.user_id} onChange={(e) => setForm((current) => ({ ...current, user_id: e.target.value }))}>
                <option value="">Select student</option>
                {students.map((item) => <option key={item.id} value={item.id}>{item.full_name || item.email}</option>)}
              </select>
            </div>
          ) : (
            <div className="field">
              <label>Student</label>
              <input value="All approved students" disabled />
            </div>
          )}
          <div className="field-grid">
            <div className="field"><label>From Page</label><input value={form.page_from} onChange={(e) => setForm((current) => ({ ...current, page_from: e.target.value }))} placeholder="Page 1" /></div>
            <div className="field"><label>To Page</label><input value={form.page_to} onChange={(e) => setForm((current) => ({ ...current, page_to: e.target.value }))} placeholder="Page 5" /></div>
          </div>
          <div className="field"><label>Assigned For</label><input type="date" value={form.assigned_for} onChange={(e) => setForm((current) => ({ ...current, assigned_for: e.target.value }))} /></div>
          <div className="field"><label>Notes</label><textarea rows={4} value={form.notes} onChange={(e) => setForm((current) => ({ ...current, notes: e.target.value }))} placeholder="Optional guidance for the student" /></div>
          {error ? <div className="error-msg">{error}</div> : null}
          {success ? <div className="success-msg">{success}</div> : null}
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{saving ? 'Assigning...' : 'Assign Duty'}</button>
            <button type="button" className="btn-outline" onClick={() => setShowModal(false)} style={{ width: 'auto' }}>Cancel</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
