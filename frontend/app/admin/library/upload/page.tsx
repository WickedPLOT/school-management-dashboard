'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type ResourceType = 'link' | 'file' | 'note';

const DEFAULT_FORM = {
  title: '',
  category: 'General',
  description: '',
  resource_type: 'link' as ResourceType,
  external_url: '',
  file_name: '',
  file_data: '',
  note_content: '',
  audience: 'students',
  section_scope: 'all',
  is_published: true,
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [user, setUser] = useState<{ role: string; section: 'brothers' | 'sisters' } | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((current) => ({ ...current, file_name: file.name, file_data: dataUrl }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/admin/resources', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setForm(DEFAULT_FORM);
      setSuccess('Resource uploaded to the knowledge hub.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Upload Knowledge Resource</h1>
        <p>Create a link, file, or note resource for student or admin access.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>New Resource</h2>
            <p>Published resources appear immediately in the student knowledge hub.</p>
          </div>
        </div>

        <form onSubmit={save} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field-grid">
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
            </div>
            <div className="field">
              <label>Category</label>
              <input value={form.category} onChange={(e) => setForm((current) => ({ ...current, category: e.target.value }))} />
            </div>
          </div>

          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />
          </div>

          <div className="field-grid">
            <div className="field">
              <label>Resource Type</label>
              <select value={form.resource_type} onChange={(e) => setForm((current) => ({ ...current, resource_type: e.target.value as ResourceType }))}>
                <option value="link">Link</option>
                <option value="file">File</option>
                <option value="note">Note</option>
              </select>
            </div>
            <div className="field">
              <label>Audience</label>
              <select value={form.audience} onChange={(e) => setForm((current) => ({ ...current, audience: e.target.value }))}>
                <option value="students">Students</option>
                <option value="admins">Admins</option>
                <option value="both">Both</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Section Scope</label>
            {user?.role === 'super_admin' ? (
              <select value={form.section_scope} onChange={(e) => setForm((current) => ({ ...current, section_scope: e.target.value }))}>
                <option value="all">Both Centers</option>
                <option value="brothers">{BROTHERS_CENTER_NAME}</option>
                <option value="sisters">{SISTERS_CENTER_NAME}</option>
              </select>
            ) : (
              <input value={user?.section === 'sisters' ? SISTERS_CENTER_NAME : BROTHERS_CENTER_NAME} disabled />
            )}
          </div>

          {form.resource_type === 'link' ? (
            <div className="field">
              <label>External URL</label>
              <input value={form.external_url} onChange={(e) => setForm((current) => ({ ...current, external_url: e.target.value }))} placeholder="https://..." />
            </div>
          ) : null}

          {form.resource_type === 'file' ? (
            <div className="field">
              <label>Upload File</label>
              <input type="file" onChange={onFileChange} />
            </div>
          ) : null}

          {form.resource_type === 'note' ? (
            <div className="field">
              <label>Note Content</label>
              <textarea rows={6} value={form.note_content} onChange={(e) => setForm((current) => ({ ...current, note_content: e.target.value }))} />
            </div>
          ) : null}

          <div className="field">
            <label>
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm((current) => ({ ...current, is_published: e.target.checked }))} style={{ marginRight: 8 }} />
              Publish immediately
            </label>
          </div>

          {error ? <div className="error-msg">{error}</div> : null}
          {success ? <div className="success-msg">{success}</div> : null}
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Resource'}
          </button>
        </form>
      </section>
    </div>
  );
}
