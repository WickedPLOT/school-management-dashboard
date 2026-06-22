'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import Modal from '@/components/Modal';
import MoreDropdown from '@/components/MoreDropdown';

type Book = {
  id: number;
  title: string;
  description?: string;
  total_pages: number;
  section_scope: 'brothers' | 'sisters' | 'all';
  is_published: boolean;
  student_count: string;
  avg_progress: string;
  file_name?: string;
  file_data?: string;
  created_at: string;
};

const DEFAULT_FORM = { title: '', description: '', total_pages: '', file_name: '', file_data: '' };

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export default function Page() {
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [selectedFile, setSelectedFile] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/admin/books')
      .then((data) => setBooks(data))
      .catch((err) => { if (err instanceof Error) setError(err.message); })
      .finally(() => setLoading(false));
  }, []);



  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setForm((f) => ({ ...f, file_name: file.name, file_data: dataUrl }));
    setSelectedFile(file.name);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, total_pages: parseInt(form.total_pages) || 0 };
      if (editId) {
        const updated = await apiFetch(`/admin/books/${editId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        setBooks((current) => current.map((b) => b.id === editId ? { ...b, ...updated } : b));
        setEditId(null);
      } else {
        const created = await apiFetch('/admin/books', { method: 'POST', body: JSON.stringify(payload) });
        setBooks((current) => [created, ...current]);
      }
      setForm(DEFAULT_FORM);
      setSelectedFile('');
      setShowModal(false);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(book: Book) {
    try {
      const updated = await apiFetch(`/admin/books/${book.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title: book.title, total_pages: book.total_pages, section_scope: book.section_scope, is_published: !book.is_published }),
      });
      setBooks((current) => current.map((b) => b.id === book.id ? { ...b, ...updated } : b));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  async function deleteBook(id: number) {
    if (!confirm('Delete this book?')) return;
    try {
      await apiFetch(`/admin/books/${id}`, { method: 'DELETE' });
      setBooks((current) => current.filter((b) => b.id !== id));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  function openAddModal() {
    setEditId(null);
    setForm(DEFAULT_FORM);
    setSelectedFile('');
    setError('');
    setShowModal(true);
  }

  function startEdit(book: Book) {
    setEditId(book.id);
    setForm({ title: book.title, description: book.description || '', total_pages: String(book.total_pages), file_name: '', file_data: '' });
    setSelectedFile(book.file_name || '');
    setError('');
    setShowModal(true);
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Academic Books</h1>
        <p>Upload and manage books that students track their reading progress on.</p>
      </div>

      {error && !showModal ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Book List</h2>
            <p>{books.length} book{books.length !== 1 ? 's' : ''} total</p>
          </div>
          <button type="button" className="btn-primary" onClick={openAddModal} style={{ width: 'auto', padding: '0.4rem 0.9rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            + Add Book
          </button>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading books...</p></div>
        ) : books.length === 0 ? (
          <div className="empty-state"><p>No books added yet.</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Pages</th>
                  <th>File</th>
                  <th>Students</th>
                  <th>Avg Progress</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {books.map((book) => (
                  <tr key={book.id} style={{ cursor: 'pointer' }}>
                    <td>
                      <Link href={`/admin/books/detail/${book.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                        <strong>{book.title}</strong>
                      </Link>
                    </td>
                    <td>{book.total_pages || '—'}</td>
                    <td>
                      {book.file_name ? (
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{book.file_name}</span>
                      ) : (
                        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                    <td>{book.student_count}</td>
                    <td>{book.avg_progress}%</td>
                    <td>
                      <span className={`badge badge-${book.is_published ? 'approved' : 'pending'}`}>
                        {book.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <MoreDropdown items={[
                        { label: 'Edit', onClick: () => startEdit(book), color: '#1a5fa8' },
                        { label: book.is_published ? 'Unpublish' : 'Publish', onClick: () => togglePublish(book), color: '#a8681a' },
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

      <Modal open={showModal} onClose={() => { setShowModal(false); setEditId(null); setForm(DEFAULT_FORM); setSelectedFile(''); }}>
        <div className="section-outline-header">
          <div>
            <h2>{editId ? 'Edit Book' : 'Add Book'}</h2>
            <p>Books appear in each student&apos;s progress page.</p>
          </div>
          <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => { setShowModal(false); setEditId(null); setForm(DEFAULT_FORM); setSelectedFile(''); }}>Close</button>
        </div>
        <form onSubmit={handleSubmit} className="form-stack" style={{ padding: '1rem' }}>
          <div className="field">
            <label>Title <span style={{ color: '#dc2626' }}>*</span></label>
            <input required value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Book title" />
          </div>
          <div className="field">
            <label>Total Pages</label>
            <input type="number" min={0} value={form.total_pages} onChange={(e) => setForm((f) => ({ ...f, total_pages: e.target.value }))} placeholder="e.g. 320" />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Brief description" />
          </div>
          <div className="field">
            <label>Upload Book (PDF)</label>
            <input type="file" accept=".pdf,application/pdf" onChange={onFileChange} />
            {selectedFile ? (
              <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)' }}>
                Selected: {selectedFile}
              </div>
            ) : null}
          </div>
          {error ? <div className="error-msg">{error}</div> : null}
          <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn-primary" disabled={saving} style={{ width: 'auto', paddingInline: '1.25rem' }}>{saving ? 'Saving...' : editId ? 'Update Book' : 'Add Book'}</button>
                <button type="button" className="btn-outline" onClick={() => { setShowModal(false); setEditId(null); setForm(DEFAULT_FORM); setSelectedFile(''); }} style={{ width: 'auto' }}>Cancel</button>
              </div>
        </form>
      </Modal>
    </div>
  );
}
