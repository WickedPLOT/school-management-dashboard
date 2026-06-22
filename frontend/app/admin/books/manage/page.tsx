'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Modal from '@/components/Modal';
import MoreDropdown from '@/components/MoreDropdown';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

interface Book {
  id: number;
  title: string;
  description: string | null;
  author: string | null;
  total_pages: number;
  section_scope: 'brothers' | 'sisters' | 'all';
  is_published: boolean;
  created_by_email?: string;
  student_count?: number;
  avg_progress?: number;
  created_at: string;
}

interface UploadForm {
  title: string;
  description: string;
  section_scope: 'brothers' | 'sisters' | 'all';
  is_published: boolean;
  file?: File;
}

const DEFAULT_UPLOAD_FORM: UploadForm = {
  title: '',
  description: '',
  section_scope: 'all',
  is_published: true,
};

export default function BookManagePage() {
  const [user, setUser] = useState<{ role: string; section: 'brothers' | 'sisters' } | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState<UploadForm>(DEFAULT_UPLOAD_FORM);
  const [fileName, setFileName] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadBooks() {
    try {
      const data = await apiFetch('/admin/books');
      setBooks(data);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    loadBooks();
  }, []);

  async function togglePublished(book: Book) {
    try {
      const updated = await apiFetch(`/admin/books/${book.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: book.title,
          description: book.description,
          section_scope: book.section_scope,
          is_published: !book.is_published,
        }),
      });
      setBooks(current => current.map(b => b.id === book.id ? updated : b));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  async function deleteBook(bookId: number) {
    if (!window.confirm('Are you sure you want to delete this book?')) return;

    setDeleting(bookId);
    try {
      await apiFetch(`/admin/books/${bookId}`, { method: 'DELETE' });
      setBooks(current => current.filter(b => b.id !== bookId));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setDeleting(null);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) {
      setFileName('');
      setUploadForm(f => ({ ...f, file: undefined }));
      return;
    }

    if (file.type !== 'application/pdf') {
      setError('Only PDF files are allowed');
      setFileName('');
      setUploadForm(f => ({ ...f, file: undefined }));
      return;
    }

    setFileName(file.name);
    setUploadForm(f => ({ ...f, file }));
    setError('');
  }

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (!uploadForm.title.trim()) throw new Error('Please enter a book title');
      if (!uploadForm.file) throw new Error('Please select a PDF file');

      const formData = new FormData();
      formData.append('title', uploadForm.title);
      formData.append('description', uploadForm.description);
      formData.append('section_scope', uploadForm.section_scope);
      formData.append('is_published', String(uploadForm.is_published));
      formData.append('file', uploadForm.file);

      const result = await apiFetch('/admin/books', {
        method: 'POST',
        body: formData,
      });

      setBooks(current => [result, ...current]);
      setShowUploadModal(false);
      setUploadForm(DEFAULT_UPLOAD_FORM);
      setFileName('');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function openUploadModal() {
    setUploadForm(DEFAULT_UPLOAD_FORM);
    setFileName('');
    setShowUploadModal(true);
  }

  return (
    <div className="section-shell">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Manage Books</h1>
          <p>Control which books are visible to students and track reading progress.</p>
        </div>
        <button onClick={openUploadModal} className="btn-primary" style={{ whiteSpace: 'nowrap' }}>
          + Upload Book
        </button>
      </div>

      {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Books Library</h2>
            <p>Published books appear in student Knowledge Hub. Draft books are only visible to admins.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading books...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="empty-state">
            <p>No books uploaded yet. Click "+ Upload Book" to get started!</p>
          </div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Pages</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th>Students</th>
                  <th>Avg. Progress</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {books.map(book => (
                  <tr key={book.id}>
                    <td>
                      <strong>{book.title}</strong>
                      {book.description && (
                        <div className="table-muted" style={{ fontSize: '0.875rem' }}>
                          {book.description.substring(0, 60)}...
                        </div>
                      )}
                      <div className="table-muted" style={{ fontSize: '0.75rem' }}>
                        {new Date(book.created_at).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td>{book.total_pages}</td>
                    <td style={{ textTransform: 'capitalize' }}>{book.section_scope}</td>
                    <td>
                      <span className={`badge badge-${book.is_published ? 'approved' : 'pending'}`}>
                        {book.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>{book.student_count || 0}</td>
                    <td>
                      {book.avg_progress !== undefined ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: '100px',
                            height: '4px',
                            backgroundColor: '#e0e0e0',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(book.avg_progress, 100)}%`,
                              backgroundColor: '#10b981',
                            }} />
                          </div>
                          <span style={{ fontSize: '0.875rem' }}>
                            {book.avg_progress?.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <MoreDropdown items={[
                        { label: 'View Details', onClick: () => window.location.href = `/admin/books/detail/${book.id}`, color: '#1a5fa8' },
                        { label: book.is_published ? 'Unpublish' : 'Publish', onClick: () => togglePublished(book), color: '#a8681a' },
                        { label: 'Delete', onClick: () => deleteBook(book.id), color: '#dc2626' },
                      ]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Upload Modal */}
      <Modal open={showUploadModal} onClose={() => setShowUploadModal(false)}>
        <div className="section-outline-header">
          <div>
            <h2>Upload New Book</h2>
            <p>Upload a PDF book to the knowledge hub</p>
          </div>
          <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setShowUploadModal(false)}>Close</button>
        </div>

        <form onSubmit={handleUploadSubmit} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field-grid">
            <div className="field">
              <label>Book Title *</label>
              <input
                value={uploadForm.title}
                onChange={(e) => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g., The Words"
              />
            </div>
            <div className="field">
              <label>Section Scope *</label>
              {user?.role === 'super_admin' ? (
                <select
                  value={uploadForm.section_scope}
                  onChange={(e) => setUploadForm(f => ({ ...f, section_scope: e.target.value as any }))}
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
            <label>Description</label>
            <textarea
              rows={3}
              value={uploadForm.description}
              onChange={(e) => setUploadForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Brief description of the book..."
            />
          </div>

          <div className="field">
            <label>PDF File *</label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
            />
            {fileName && (
              <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--muted)' }}>
                Selected: {fileName}
              </div>
            )}
          </div>

          <div className="field">
            <label>
              <input
                type="checkbox"
                checked={uploadForm.is_published}
                onChange={(e) => setUploadForm(f => ({ ...f, is_published: e.target.checked }))}
                style={{ marginRight: 8 }}
              />
              Publish immediately
            </label>
          </div>

          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !uploadForm.file}
              style={{ width: 'auto', paddingInline: '1.25rem' }}
            >
              {saving ? 'Uploading...' : 'Upload Book'}
            </button>
            <button type="button" className="btn-outline" onClick={() => setShowUploadModal(false)} style={{ width: 'auto' }}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
