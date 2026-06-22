'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Modal from './Modal';

type UpdateItem = {
  id: number;
  user_id: number;
  track: 'academic' | 'religious' | 'activity';
  title: string;
  summary: string;
  details?: string;
  progress_score?: string | number;
  review_status: 'submitted' | 'reviewed';
  admin_note?: string;
  created_at: string;
  reviewed_at?: string;
  full_name?: string;
  email: string;
  institution?: string;
  course?: string;
  reviewed_by_email?: string;
};

type StudentProgress = {
  id: number;
  email: string;
  section: string;
  full_name: string | null;
  total_books: string;
  books_reading: string;
  books_completed: string;
  total_pages_read: string;
  total_book_pages: string;
};

type StudentBookDetail = {
  id: number;
  title: string;
  total_pages: number;
  file_name: string | null;
  file_data: string | null;
  pages_read: number;
  status: string;
  notes: string | null;
  updated_at: string;
};

export default function AdminProgressReview({
  pageTitle,
  pageDescription,
  defaultTrack,
  allowTrackSelection,
}: {
  pageTitle: string;
  pageDescription: string;
  defaultTrack: 'all' | 'academic' | 'religious' | 'activity';
  allowTrackSelection?: boolean;
}) {
  const [updates, setUpdates] = useState<UpdateItem[]>([]);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [studentBooks, setStudentBooks] = useState<Record<number, StudentBookDetail[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [trackFilter, setTrackFilter] = useState(defaultTrack);
  const [drafts, setDrafts] = useState<Record<number, { admin_note: string; progress_score: string; review_status: 'submitted' | 'reviewed' }>>({});
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modalItem, setModalItem] = useState<{ type: 'update' | 'student'; item: UpdateItem | StudentProgress } | null>(null);

  useEffect(() => {
    const suffix = trackFilter === 'all' ? '' : `?track=${trackFilter}`;
    Promise.all([
      apiFetch(`/admin/progress/updates${suffix}`),
      apiFetch('/admin/students/book-progress'),
    ])
      .then(([updatesData, studentsData]) => {
        setUpdates(updatesData);
        setStudents(studentsData);
      })
      .catch((err) => { if (err instanceof Error) setError(err.message); })
      .finally(() => setLoading(false));
  }, [trackFilter]);

  async function loadStudentDetail(studentId: number) {
    setLoadingDetail(studentId);
    try {
      const data = await apiFetch(`/admin/students/${studentId}/books`);
      setStudentBooks((current) => ({ ...current, [studentId]: data.books }));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoadingDetail(null);
    }
  }

  const summary = useMemo(() => ({
    total: updates.length,
    submitted: updates.filter((item) => item.review_status === 'submitted').length,
    reviewed: updates.filter((item) => item.review_status === 'reviewed').length,
  }), [updates]);

  function getDraft(item: UpdateItem) {
    return drafts[item.id] || {
      admin_note: item.admin_note || '',
      progress_score: item.progress_score?.toString() || '',
      review_status: item.review_status,
    };
  }

  function updateDraft(id: number, key: 'admin_note' | 'progress_score' | 'review_status', value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...getDraft(updates.find((item) => item.id === id)!),
        ...current[id],
        [key]: value,
      },
    }));
  }

  async function saveReview(item: UpdateItem) {
    const draft = getDraft(item);
    setSavingId(item.id);
    try {
      const updated = await apiFetch(`/admin/progress/updates/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          admin_note: draft.admin_note,
          progress_score: draft.progress_score ? Number(draft.progress_score) : null,
          review_status: draft.review_status,
        }),
      });
      setUpdates((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function getProgressPercent(student: StudentProgress): number {
    const total = Number(student.total_book_pages);
    const read = Number(student.total_pages_read);
    if (!total) return 0;
    return Math.round((read / total) * 100);
  }

  function getStatusLabel(status: string) {
    if (status === 'completed') return 'Completed';
    if (status === 'reading') return 'Reading';
    return 'Not Started';
  }

  function getStatusBadge(status: string) {
    if (status === 'completed') return 'badge-approved';
    if (status === 'reading') return 'badge-pending';
    return '';
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>{pageTitle}</h1>
        <p>{pageDescription}</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><h3>{summary.total}</h3><p>Total updates</p></div></div>
        <div className="stat-card"><div><h3>{summary.submitted}</h3><p>Awaiting review</p></div></div>
        <div className="stat-card"><div><h3>{summary.reviewed}</h3><p>Reviewed</p></div></div>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Review Queue</h2>
            <p>Student-submitted progress and periodic activity updates.</p>
          </div>
          {allowTrackSelection ? (
            <div className="field" style={{ minWidth: 180 }}>
              <label>Track</label>
              <select value={trackFilter} onChange={(e) => setTrackFilter(e.target.value as typeof trackFilter)}>
                <option value="all">All updates</option>
                <option value="academic">Academic</option>
                <option value="religious">Religious</option>
                <option value="activity">Activity</option>
              </select>
            </div>
          ) : null}
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}

        {loading ? (
          <div className="empty-state"><p>Loading updates...</p></div>
        ) : updates.length === 0 && students.length === 0 ? (
          <div className="empty-state"><p>No students found.</p></div>
        ) : updates.length > 0 ? (
          <div className="review-stack">
            {updates.map((item) => (
              <article key={item.id} className="review-card compact-review-card">
                <button type="button" className="compact-review-line" onClick={() => setModalItem({ type: 'update', item })}>
                  <span>
                    <strong>{item.title}</strong>
                    <small>
                      <Link href={`/admin/profiles/${item.user_id}`} className="student-name-link" onClick={(e) => e.stopPropagation()}>
                        {item.full_name || item.email}
                      </Link>
                      {' '}· {item.track} · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </small>
                  </span>
                  <span className={`badge badge-${item.review_status === 'reviewed' ? 'approved' : 'pending'}`}>{item.review_status}</span>
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="review-stack">
            {students.map((student) => (
              <article key={student.id} className="review-card compact-review-card">
                <button
                  type="button"
                  className="compact-review-line"
                  onClick={() => {
                    setModalItem({ type: 'student', item: student });
                    if (!studentBooks[student.id]) loadStudentDetail(student.id);
                  }}
                >
                  <span>
                    <strong>{student.full_name || student.email}</strong>
                    <small>
                      {student.email} · {student.section}
                    </small>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                      {Number(student.total_books)} books · {getProgressPercent(student)}%
                    </span>
                  </span>
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal open={!!modalItem} onClose={() => setModalItem(null)}>
        {modalItem?.type === 'update' ? (
          (() => {
            const item = modalItem.item as UpdateItem;
            const draft = getDraft(item);
            return (
              <div>
                <div className="section-outline-header">
                  <div>
                    <h2>{item.title}</h2>
                    <p>{item.full_name || item.email} · {item.track}</p>
                  </div>
                  <button type="button" className="btn-outline" onClick={() => setModalItem(null)}>Close</button>
                </div>
                <form className="form-stack" style={{ padding: '1rem' }}>
                  <div className="review-meta-grid">
                    <div><strong>Summary</strong><span>{item.summary}</span></div>
                    <div><strong>Institution</strong><span>{item.institution || '—'}</span></div>
                    <div><strong>Course</strong><span>{item.course || '—'}</span></div>
                    <div><strong>Score</strong><span>{item.progress_score ?? '—'}</span></div>
                  </div>
                  {item.details ? <p className="review-details">{item.details}</p> : null}
                  <div className="field-grid" style={{ paddingTop: '0.5rem' }}>
                    <div className="field">
                      <label>Review Status</label>
                      <select value={draft.review_status} onChange={(e) => updateDraft(item.id, 'review_status', e.target.value)}>
                        <option value="submitted">Submitted</option>
                        <option value="reviewed">Reviewed</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>Progress Score</label>
                      <input value={draft.progress_score} onChange={(e) => updateDraft(item.id, 'progress_score', e.target.value)} placeholder="e.g. 78" />
                    </div>
                  </div>
                  <div className="field">
                    <label>Comment</label>
                    <textarea rows={3} value={draft.admin_note} onChange={(e) => updateDraft(item.id, 'admin_note', e.target.value)} placeholder="Feedback or follow-up note" />
                  </div>
                  <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn-primary" style={{ width: 'auto', paddingInline: '1.25rem' }} disabled={savingId === item.id} onClick={() => saveReview(item)}>
                      {savingId === item.id ? 'Saving...' : 'Save Review'}
                    </button>
                    <button type="button" className="btn-outline" onClick={() => setModalItem(null)} style={{ width: 'auto' }}>Cancel</button>
                  </div>
                </form>
              </div>
            );
          })()
        ) : modalItem?.type === 'student' ? (
          (() => {
            const student = modalItem.item as StudentProgress;
            const books = studentBooks[student.id];
            return (
              <div>
                <div className="section-outline-header">
                  <div>
                    <h2>{student.full_name || student.email}</h2>
                    <p>{student.email} · {student.section}</p>
                  </div>
                  <button type="button" className="btn-outline" onClick={() => setModalItem(null)}>Close</button>
                </div>
                <div style={{ padding: '1rem', display: 'grid', gap: '1rem' }}>
                  <div className="review-meta-grid">
                    <div><strong>Total Books</strong><span>{student.total_books}</span></div>
                    <div><strong>Reading</strong><span>{student.books_reading}</span></div>
                    <div><strong>Completed</strong><span>{student.books_completed}</span></div>
                    <div><strong>Pages Read</strong><span>{student.total_pages_read} / {student.total_book_pages}</span></div>
                  </div>

                  {loadingDetail === student.id ? (
                    <p style={{ color: 'var(--muted)' }}>Loading book details...</p>
                  ) : books && books.length > 0 ? (
                    <div className="panel-table-wrap">
                      <table className="panel-table">
                        <thead>
                          <tr>
                            <th>Book</th>
                            <th>Pages</th>
                            <th>Status</th>
                            <th>Progress</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {books.map((book) => (
                            <tr key={book.id}>
                              <td>
                                <strong>{book.title}</strong>
                                {book.file_name ? <div className="table-muted">{book.file_name}</div> : null}
                              </td>
                              <td>{book.pages_read} / {book.total_pages || '—'}</td>
                              <td><span className={`badge ${getStatusBadge(book.status)}`}>{getStatusLabel(book.status)}</span></td>
                              <td>
                                {book.total_pages > 0 ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div style={{ flex: 1, height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${Math.round((book.pages_read / book.total_pages) * 100)}%`, background: book.status === 'completed' ? '#16a34a' : '#2563eb', borderRadius: 999 }} />
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>{Math.round((book.pages_read / book.total_pages) * 100)}%</span>
                                  </div>
                                ) : (
                                  <span className="table-muted">—</span>
                                )}
                              </td>
                              <td>
                                {book.file_data ? (
                                  <a href={book.file_data} download={book.file_name || book.title} className="btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem', textDecoration: 'none' }}>
                                    View PDF
                                  </a>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: 'var(--muted)' }}>No books available yet.</p>
                  )}
                </div>
              </div>
            );
          })()
        ) : null}
      </Modal>
    </div>
  );
}
