'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Admin = { id: number; email: string; role: string; section: string; status: string; created_at: string };

export default function AdminManagementPage() {
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '', section: 'brothers' });
  const [formError, setFormError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    apiFetch('/admin/admins')
      .then(setAdmins)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function createAdmin(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setCreating(true);
    try {
      const newAdmin = await apiFetch('/admin/admins', { method: 'POST', body: JSON.stringify(form) });
      setAdmins(a => [...a, newAdmin]);
      setForm({ email: '', password: '', section: 'brothers' });
      setShowForm(false);
    } catch (e: any) { setFormError(e.message); }
    finally { setCreating(false); }
  }

  async function deactivate(id: number) {
    if (!confirm('Deactivate this admin?')) return;
    try {
      await apiFetch(`/admin/admins/${id}`, { method: 'DELETE' });
      setAdmins(a => a.filter(x => x.id !== id));
    } catch (e: any) { alert(e.message); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1>Admin Management</h1>
          <p>Create and manage Brothers and Sisters section admins</p>
        </div>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
          onClick={() => setShowForm(s => !s)}
        >
          {showForm ? 'Cancel' : 'Add Admin'}
        </button>
      </div>

      {showForm && (
        <div className="content-card" style={{ marginBottom: '1.5rem' }}>
          <div className="content-card-header"><h2>New Admin Account</h2></div>
          <form onSubmit={createAdmin} style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="field">
              <label>Email <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@hayrat.com" />
            </div>
            <div className="field">
              <label>Password <span style={{ color: '#dc2626' }}>*</span></label>
              <input type="password" required minLength={6} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Min. 6 characters" />
            </div>
            <div className="field">
              <label>Section <span style={{ color: '#dc2626' }}>*</span></label>
              <select value={form.section} onChange={e => setForm({ ...form, section: e.target.value })}>
                <option value="brothers">Brothers</option>
                <option value="sisters">Sisters</option>
              </select>
            </div>
            {formError && <div className="error-msg" style={{ gridColumn: '1 / -1' }}>{formError}</div>}
            <div style={{ gridColumn: '1 / -1' }}>
              <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.625rem 1.5rem' }} disabled={creating}>
                {creating ? 'Creating...' : 'Create Admin'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="content-card">
        <div className="content-card-header">
          <h2>Section Admins</h2>
          <span>{admins.length} admins</span>
        </div>
        {loading && <div className="empty-state"><p>Loading...</p></div>}
        {error   && <div style={{ padding: '1.5rem' }}><div className="error-msg">{error}</div></div>}
        {!loading && !error && admins.length === 0 && <div className="empty-state"><p>No section admins yet.</p></div>}
        {admins.map(a => (
          <div key={a.id} className="reg-item">
            <div className="reg-item-left">
              <div className="avatar">{a.email[0].toUpperCase()}</div>
              <div>
                <div className="reg-email">{a.email}</div>
                <div className="reg-meta" style={{ marginTop: '0.3rem' }}>
                  <span className={`badge badge-${a.section}`}>{a.section}</span>
                  <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>{a.role.replace('_', ' ')}</span>
                  <span className="reg-date">
                    Added {new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="reg-item-actions">
              <button className="btn-reject" onClick={() => deactivate(a.id)}>Deactivate</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
