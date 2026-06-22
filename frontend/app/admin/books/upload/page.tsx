'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

interface UploadForm {
  title: string;
  description: string;
  section_scope: 'brothers' | 'sisters' | 'all';
  is_published: boolean;
  file?: File;
}

const DEFAULT_FORM: UploadForm = {
  title: '',
  description: '',
  section_scope: 'all',
  is_published: true,
};

export default function BookUploadPage() {
  const [user, setUser] = useState<{ role: string; section: 'brothers' | 'sisters' } | null>(null);
  const [form, setForm] = useState<UploadForm>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [fileName, setFileName] = useState('');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName('');
      setForm(f => ({ ...f, file: undefined }));
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      setFileName('');
      setForm(f => ({ ...f, file: undefined }));
      return;
    }

    setFileName(file.name);
    setForm(f => ({ ...f, file }));
    setError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!form.title.trim()) {
        throw new Error('Please enter a book title');
      }

      if (!form.file) {
        throw new Error('Please select a PDF file');
      }

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('title', form.title);
      formData.append('description', form.description);
      formData.append('section_scope', form.section_scope);
      formData.append('is_published', String(form.is_published));
      formData.append('file', form.file);

      const result = await apiFetch('/admin/books', {
        method: 'POST',
        body: formData,
      });

      setSuccess(`Book "${result.title}" uploaded successfully with ${result.total_pages} pages!`);
      setForm(DEFAULT_FORM);
      setFileName('');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Upload Book</h1>
        <p>Upload PDF books to the knowledge hub. Students in the selected section will be notified.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>New Book</h2>
            <p>Published books appear immediately and students receive notifications.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field-grid">
            <div className="field">
              <label htmlFor="title">Book Title *</label>
              <input
                id="title"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., The Words"
              />
            </div>
            <div className="field">
              <label htmlFor="scope">Section Scope *</label>
              {user?.role === 'super_admin' ? (
                <select
                  id="scope"
                  value={form.section_scope}
                  onChange={(e) => setForm(f => ({ ...f, section_scope: e.target.value as any }))}
                >
                  <option value="all">Both Centers</option>
                  <option value="brothers">{BROTHERS_CENTER_NAME}</option>
                  <option value="sisters">{SISTERS_CENTER_NAME}</option>
                </select>
              ) : (
                <input value={user?.section === 'sisters' ? SISTERS_CENTER_NAME : BROTHERS_CENTER_NAME} disabled />
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the book..."
            />
          </div>

          <div className="field">
            <label htmlFor="file">PDF File *</label>
            <input
              id="file"
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
            {fileName && (
              <div className="success-msg" style={{ marginTop: '0.5rem' }}>
                Selected: {fileName}
              </div>
            )}
          </div>

          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={form.is_published}
                onChange={(e) => setForm(f => ({ ...f, is_published: e.target.checked }))}
                style={{ marginRight: 8 }}
              />
              Publish immediately
            </label>
          </div>

          {error ? <div className="error-msg">{error}</div> : null}
          {success ? <div className="success-msg">{success}</div> : null}

          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !form.file}
          >
            {saving ? 'Uploading...' : 'Upload Book'}
          </button>
        </form>
      </section>
    </div>
  );
}
