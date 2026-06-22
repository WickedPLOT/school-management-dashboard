'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Book = { id: number; title: string; author?: string; total_pages: number; student_count: string; avg_progress: string; };
type StudentRow = { id: number; email: string; full_name?: string; section: string; pages_read: number; status: string; notes?: string; updated_at?: string; };

function pct(pages: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((pages / total) * 100));
}

const STATUS_BADGE: Record<string, string> = {
  completed:   'badge-approved',
  reading:     'badge-reading',
  not_started: 'badge-pending',
};

export default function Page() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch('/admin/books').then((b) => setBooks(b)).finally(() => setLoading(false));
  }, []);

  async function viewBook(book: Book) {
    setSelectedBook(book);
    setStudents([]);
    setSearch('');
    setLoadingStudents(true);
    try {
      const data = await apiFetch(`/admin/books/${book.id}/progress`);
      setStudents(data.students || []);
    } finally {
      setLoadingStudents(false);
    }
  }

  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (s.full_name || s.email).toLowerCase().includes(q);
  });

  return (
    <div className="section-shell">
      <div className="page-header">
        <div>
          <h1>Student Reading Progress</h1>
          <p>Select a book to see how far each student has progressed.</p>
        </div>
        {selectedBook ? (
          <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedBook(null)}>← All Books</button>
        ) : null}
      </div>

      {!selectedBook ? (
        /* Book list */
        loading ? <div className="empty-state"><p>Loading books...</p></div>
        : books.length === 0 ? <div className="empty-state"><p>No books yet. Add books from Books Management.</p></div>
        : (
          <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
            {books.map((book) => {
              const avg = Number(book.avg_progress) || 0;
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => viewBook(book)}
                  style={{ all: 'unset', cursor: 'pointer', border: '1px solid var(--border)', borderRadius: '0.85rem', padding: '1.1rem', background: 'var(--card)', display: 'grid', gap: '0.6rem', transition: 'box-shadow 0.15s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.boxShadow = '')}
                >
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>{book.title}</strong>
                    {book.author ? <div style={{ color: 'var(--muted)', fontSize: '0.78rem' }}>{book.author}</div> : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ flex: 1, height: 7, background: '#e5e7eb', borderRadius: 999 }}>
                      <div style={{ width: `${avg}%`, height: '100%', background: avg >= 80 ? '#0f5132' : '#2563eb', borderRadius: 999 }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: avg >= 80 ? '#0f5132' : '#2563eb' }}>{avg}%</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    <span>{book.total_pages} pages</span>
                    <span style={{ background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.6rem', borderRadius: 999, fontWeight: 600 }}>{book.student_count} students</span>
                  </div>
                </button>
              );
            })}
          </div>
        )
      ) : (
        /* Student progress for selected book */
        <section className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>{selectedBook.title}</h2>
              <p>{selectedBook.author ? `${selectedBook.author} · ` : ''}{selectedBook.total_pages} pages · {students.length} students</p>
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student..."
              style={{ border: '1px solid var(--border)', borderRadius: '0.5rem', padding: '0.4rem 0.75rem', fontSize: '0.85rem', outline: 'none', width: 200 }}
            />
          </div>
          {loadingStudents ? (
            <div className="empty-state"><p>Loading student progress...</p></div>
          ) : (
            <div className="panel-table-wrap">
              <table className="panel-table">
                <thead>
                  <tr><th>Student</th><th>Status</th><th>Progress</th><th>Pages</th><th>Last Updated</th></tr>
                </thead>
                <tbody>
                  {filtered.map((s) => {
                    const p = pct(s.pages_read, selectedBook.total_pages);
                    const barColor = s.status === 'completed' ? '#0f5132' : s.status === 'reading' ? '#2563eb' : '#d1d5db';
                    return (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.full_name || s.email}</strong>
                          <div className="table-muted">{s.email}</div>
                        </td>
                        <td><span className={`badge ${STATUS_BADGE[s.status] || 'badge-pending'}`} style={{ textTransform: 'capitalize' }}>{s.status.replace('_', ' ')}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ width: 100, height: 7, background: '#e5e7eb', borderRadius: 999 }}>
                              <div style={{ width: `${p}%`, height: '100%', background: barColor, borderRadius: 999 }} />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: barColor }}>{p}%</span>
                          </div>
                        </td>
                        <td>{s.pages_read} {selectedBook.total_pages ? `/ ${selectedBook.total_pages}` : ''}</td>
                        <td style={{ color: 'var(--muted)', fontSize: '0.8rem' }}>{s.updated_at ? new Date(s.updated_at).toLocaleDateString('en-GB') : '—'}</td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>No students found.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
