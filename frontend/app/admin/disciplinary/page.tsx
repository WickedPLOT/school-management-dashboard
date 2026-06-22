'use client';

import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import Modal from '@/components/Modal';
import MoreDropdown from '@/components/MoreDropdown';
import Toast from '@/components/Toast';
import { apiFetch } from '@/lib/api';

type Student = {
  id: number;
  email: string;
  full_name?: string;
  section: 'brothers' | 'sisters';
};

type DisciplineRecord = {
  id: number;
  user_id: number;
  incident_date: string;
  category: string;
  severity: 'minor' | 'moderate' | 'serious';
  title: string;
  description: string;
  action_taken?: string;
  status: 'open' | 'under_review' | 'resolved';
  created_at: string;
  resolved_at?: string;
  full_name?: string;
  email: string;
  section: 'brothers' | 'sisters';
  created_by_name?: string;
  resolved_by_name?: string;
};

type FormState = {
  user_id: string;
  incident_date: string;
  category: string;
  severity: DisciplineRecord['severity'];
  title: string;
  description: string;
  action_taken: string;
  status: DisciplineRecord['status'];
};

const blankForm: FormState = {
  user_id: '',
  incident_date: '',
  category: '',
  severity: 'minor',
  title: '',
  description: '',
  action_taken: '',
  status: 'open',
};

export default function Page() {
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<DisciplineRecord[]>([]);
  const [form, setForm] = useState<FormState>(blankForm);
  const [editing, setEditing] = useState<DisciplineRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DisciplineRecord | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      const [studentData, recordData] = await Promise.all([
        apiFetch('/admin/students'),
        apiFetch(`/admin/disciplinary/records${params.toString() ? `?${params}` : ''}`),
      ]);
      setStudents(studentData);
      setRecords(recordData);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not load disciplinary records.' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter, severityFilter]);

  const summary = useMemo(() => ({
    total: records.length,
    open: records.filter((item) => item.status === 'open').length,
    review: records.filter((item) => item.status === 'under_review').length,
    resolved: records.filter((item) => item.status === 'resolved').length,
  }), [records]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm);
    setModalOpen(true);
  }

  function openEdit(item: DisciplineRecord) {
    setEditing(item);
    setForm({
      user_id: String(item.user_id),
      incident_date: item.incident_date?.slice(0, 10) || '',
      category: item.category || '',
      severity: item.severity,
      title: item.title || '',
      description: item.description || '',
      action_taken: item.action_taken || '',
      status: item.status,
    });
    setModalOpen(true);
  }

  async function saveRecord(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, user_id: Number(form.user_id) };
      const saved = editing
        ? await apiFetch(`/admin/disciplinary/records/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        : await apiFetch('/admin/disciplinary/records', { method: 'POST', body: JSON.stringify(payload) });
      setRecords((current) => editing
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [saved, ...current]);
      setModalOpen(false);
      setToast({ tone: 'success', message: editing ? 'Disciplinary record updated.' : 'Disciplinary record created.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not save disciplinary record.' });
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord() {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/admin/disciplinary/records/${deleteTarget.id}`, { method: 'DELETE' });
      setRecords((current) => current.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
      setToast({ tone: 'success', message: 'Disciplinary record deleted.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Could not delete disciplinary record.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      {toast ? <Toast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}

      <div className="page-header page-header-actions">
        <div>
          <h1>Disciplinary Records</h1>
          <p>Record incidents, track action taken, and close cases when resolved.</p>
        </div>
        <button type="button" className="btn-primary" onClick={openCreate}>Add Record</button>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><h3>{summary.total}</h3><p>Total records</p></div></div>
        <div className="stat-card"><div><h3>{summary.open}</h3><p>Open</p></div></div>
        <div className="stat-card"><div><h3>{summary.review}</h3><p>Under review</p></div></div>
        <div className="stat-card"><div><h3>{summary.resolved}</h3><p>Resolved</p></div></div>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Case Register</h2>
            <p>Use filters to review active or serious cases quickly.</p>
          </div>
          <div className="inline-actions">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter by status">
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="under_review">Under review</option>
              <option value="resolved">Resolved</option>
            </select>
            <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} aria-label="Filter by severity">
              <option value="all">All severities</option>
              <option value="minor">Minor</option>
              <option value="moderate">Moderate</option>
              <option value="serious">Serious</option>
            </select>
          </div>
        </div>

        {loading ? <div className="empty-state"><p>Loading records...</p></div> : records.length === 0 ? (
          <div className="empty-state"><p>No disciplinary records found.</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Incident</th>
                  <th>Severity</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.full_name || item.email}</strong><div className="table-muted">{item.section}</div></td>
                    <td><strong>{item.title}</strong><div className="table-muted">{item.category}</div></td>
                    <td><span className={`badge badge-${item.severity === 'serious' ? 'rejected' : item.severity === 'moderate' ? 'pending' : 'approved'}`}>{item.severity}</span></td>
                    <td><span className={`badge badge-${item.status === 'resolved' ? 'approved' : item.status === 'under_review' ? 'pending' : 'failed'}`}>{item.status.replace('_', ' ')}</span></td>
                    <td>{new Date(item.incident_date).toLocaleDateString('en-GB')}</td>
                    <td>
                      <MoreDropdown items={[
                        { label: 'Edit', onClick: () => openEdit(item), color: '#1a5fa8' },
                        { label: 'Delete', onClick: () => setDeleteTarget(item), color: '#dc2626' },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}>
        <div className="routine-modal">
          <form onSubmit={saveRecord} className="form-stack routine-modal-form">
            <div className="section-outline-header">
              <div>
                <h2>{editing ? 'Edit Record' : 'Add Record'}</h2>
                <p>{editing ? 'Update status, notes, or action taken.' : 'Create a disciplinary entry for a student.'}</p>
              </div>
            </div>
            <div className="field">
              <label>Student</label>
              <select required value={form.user_id} onChange={(e) => setForm((current) => ({ ...current, user_id: e.target.value }))}>
                <option value="">Select student</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.full_name || student.email} - {student.section}</option>)}
              </select>
            </div>
            <div className="field-grid">
              <div className="field"><label>Incident Date</label><input required type="date" value={form.incident_date} onChange={(e) => setForm((current) => ({ ...current, incident_date: e.target.value }))} /></div>
              <div className="field"><label>Category</label><input required value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} placeholder="Conduct, lateness, dormitory..." /></div>
            </div>
            <div className="field-grid">
              <div className="field"><label>Severity</label><select value={form.severity} onChange={(e) => setForm((current) => ({ ...current, severity: e.target.value as DisciplineRecord['severity'] }))}><option value="minor">Minor</option><option value="moderate">Moderate</option><option value="serious">Serious</option></select></div>
              <div className="field"><label>Status</label><select value={form.status} onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as DisciplineRecord['status'] }))}><option value="open">Open</option><option value="under_review">Under review</option><option value="resolved">Resolved</option></select></div>
            </div>
            <div className="field"><label>Title</label><input required value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} /></div>
            <div className="field"><label>Description</label><textarea required rows={4} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} /></div>
            <div className="field"><label>Action Taken</label><textarea rows={3} value={form.action_taken} onChange={(e) => setForm((current) => ({ ...current, action_taken: e.target.value }))} placeholder="Warning, counselling, parent contact, follow-up..." /></div>
            <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{saving ? 'Saving...' : 'Save Record'}</button>
              <button type="button" className="btn-outline" onClick={() => setModalOpen(false)} style={{ width: 'auto' }} disabled={saving}>Cancel</button>
            </div>
          </form>
        </div>
      </Modal>

      {deleteTarget ? (
        <ConfirmDialog
          title="Delete disciplinary record?"
          message={`This will permanently delete "${deleteTarget.title}" for ${deleteTarget.full_name || deleteTarget.email}.`}
          confirmLabel="Delete Record"
          tone="danger"
          loading={saving}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={deleteRecord}
        />
      ) : null}
    </div>
  );
}
