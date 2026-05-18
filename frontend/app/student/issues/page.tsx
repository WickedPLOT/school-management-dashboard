'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Issue = {
  id: number;
  title: string;
  category: string;
  location?: string;
  description: string;
  attachment_name?: string;
  attachment_data?: string;
  status: 'pending' | 'inprogress' | 'resolved';
  admin_note?: string;
  created_at: string;
  updated_at: string;
};

const DEFAULT_FORM = {
  title: '',
  category: 'Maintenance',
  location: '',
  description: '',
  attachment_name: '',
  attachment_data: '',
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read image'));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    try {
      const data = await apiFetch('/profile/issues');
      setIssues(data);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({
      ...current,
      attachment_name: file.name,
      attachment_data: dataUrl,
    }));
  }

  async function submitIssue(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await apiFetch('/profile/issues', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setIssues((current) => [created, ...current]);
      setForm(DEFAULT_FORM);
      setSuccess('Issue submitted successfully.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Issue Reporting</h1>
        <p>Report facility, maintenance, or welfare issues and attach a photo when needed.</p>
      </div>

      <div className="settings-grid">
        <section className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>New Issue</h2>
              <p>Provide enough detail for the admin team to act quickly.</p>
            </div>
          </div>
          <form onSubmit={submitIssue} className="form-stack" style={{ padding: '1rem' }}>
            <div className="field-grid">
              <div className="field">
                <label>Title</label>
                <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Broken room socket" />
              </div>
              <div className="field">
                <label>Category</label>
                <select value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))}>
                  <option>Maintenance</option>
                  <option>Electrical</option>
                  <option>Sanitation</option>
                  <option>Room Assignment</option>
                  <option>Welfare</option>
                  <option>Security</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>Location</label>
              <input value={form.location} onChange={(e) => setForm((current) => ({ ...current, location: e.target.value }))} placeholder="Dorm A, Room 3" />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea rows={5} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder="Describe the issue clearly and mention urgency if needed" />
            </div>
            <div className="field">
              <label>Attach Image</label>
              <input type="file" accept="image/*" onChange={onFileChange} />
            </div>
            {form.attachment_data ? <img src={form.attachment_data} alt="Issue attachment preview" className="issue-preview" /> : null}
            {error ? <div className="error-msg">{error}</div> : null}
            {success ? <div className="success-msg">{success}</div> : null}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Issue'}
            </button>
          </form>
        </section>

        <section className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>My Issues</h2>
              <p>Track the current status and admin feedback for your reports.</p>
            </div>
          </div>
          {loading ? (
            <div className="empty-state"><p>Loading issues...</p></div>
          ) : issues.length === 0 ? (
            <div className="empty-state"><p>No issues submitted yet.</p></div>
          ) : (
            <div className="review-stack">
              {issues.map((item) => (
                <article key={item.id} className="review-card">
                  <div className="review-card-head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.category} · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`badge badge-${item.status === 'resolved' ? 'approved' : item.status === 'inprogress' ? 'partial' : 'pending'}`}>{item.status}</span>
                  </div>
                  <p className="review-details">{item.description}</p>
                  <div className="review-meta-grid">
                    <div><strong>Location</strong><span>{item.location || '—'}</span></div>
                    <div><strong>Admin Note</strong><span>{item.admin_note || 'No note yet'}</span></div>
                  </div>
                  {item.attachment_data ? (
                    <a className="resource-link" href={item.attachment_data} target="_blank" rel="noreferrer">
                      View attachment {item.attachment_name ? `(${item.attachment_name})` : ''}
                    </a>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
