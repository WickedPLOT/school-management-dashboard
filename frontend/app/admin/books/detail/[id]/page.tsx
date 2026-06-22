'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface BookDetail {
  id: number;
  title: string;
  description?: string;
  author?: string;
  total_pages: number;
  section_scope: 'brothers' | 'sisters' | 'all';
  is_published: boolean;
  created_by_email?: string;
  student_count?: number;
  avg_progress?: number;
  created_at: string;
}

interface StudentProgress {
  id: number;
  user_id: number;
  email: string;
  full_name?: string;
  pages_read: number;
  status: 'not_started' | 'reading' | 'completed';
  notes?: string;
  last_updated: string;
}

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<BookDetail | null>(null);
  const [students, setStudents] = useState<StudentProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState<'progress' | 'name' | 'status'>('progress');
  const [filterStatus, setFilterStatus] = useState<'all' | 'not_started' | 'reading' | 'completed'>('all');

  useEffect(() => {
    async function loadBookDetails() {
      try {
        setLoading(true);
        setError('');

        // Get book details and student progress
        const [bookData, progressData] = await Promise.all([
          apiFetch(`/admin/books/${bookId}`),
          apiFetch(`/admin/books/${bookId}/progress`),
        ]);

        setBook(bookData);
        setStudents(progressData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load book details');
      } finally {
        setLoading(false);
      }
    }

    loadBookDetails();
  }, [bookId]);

  if (loading) {
    return (
      <div className="section-shell">
        <div className="page-header">
          <h1>Book Details</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="section-shell">
        <div className="page-header">
          <h1>Book Not Found</h1>
        </div>
        <div className="section-outline" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>The book you're looking for doesn't exist.</p>
          <a href="/admin/books/manage" className="btn-primary" style={{ display: 'inline-block', marginTop: '1rem' }}>
            Back to Books
          </a>
        </div>
      </div>
    );
  }

  const sortedAndFiltered = students
    .filter((s) => (filterStatus === 'all' ? true : s.status === filterStatus))
    .sort((a, b) => {
      if (sortBy === 'progress') {
        return (b.pages_read / book.total_pages) * 100 - (a.pages_read / book.total_pages) * 100;
      } else if (sortBy === 'name') {
        return (a.full_name || a.email).localeCompare(b.full_name || b.email);
      } else {
        // status: completed, reading, not_started
        const order = { completed: 0, reading: 1, not_started: 2 };
        return order[a.status as keyof typeof order] - order[b.status as keyof typeof order];
      }
    });

  const statusCounts = {
    not_started: students.filter((s) => s.status === 'not_started').length,
    reading: students.filter((s) => s.status === 'reading').length,
    completed: students.filter((s) => s.status === 'completed').length,
  };

  return (
    <div className="section-shell">
      <div className="page-header">
        <div>
          <h1>{book.title}</h1>
          {book.author && <p>by {book.author}</p>}
        </div>
        <a href="/admin/books/manage" className="btn-outline" style={{ whiteSpace: 'nowrap' }}>
          ← Back
        </a>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#fee2e2',
            color: '#991b1b',
            padding: '1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Book Info Card */}
      <div className="section-outline" style={{ marginBottom: '2rem' }}>
        <div className="section-outline-header">
          <h2>Book Information</h2>
        </div>
        <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Total Pages
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{book.total_pages}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Students Reading
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{students.length}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Average Progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{book.avg_progress?.toFixed(1) || 0}%</div>
              <div
                style={{
                  width: '100px',
                  height: '6px',
                  backgroundColor: '#e0e0e0',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(book.avg_progress || 0, 100)}%`,
                    backgroundColor: '#10b981',
                  }}
                />
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Scope
            </div>
            <div style={{ textTransform: 'capitalize' }}>{book.section_scope}</div>
          </div>

          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Status
            </div>
            <span className={`badge badge-${book.is_published ? 'approved' : 'pending'}`}>
              {book.is_published ? 'Published' : 'Draft'}
            </span>
          </div>

          <div>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Added On
            </div>
            <div>{new Date(book.created_at).toLocaleDateString('en-GB')}</div>
          </div>
        </div>

        {book.description && (
          <div style={{ padding: '1.5rem', borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
              Description
            </div>
            <p style={{ margin: 0, lineHeight: '1.5' }}>{book.description}</p>
          </div>
        )}
      </div>

      {/* Student Progress */}
      <div className="section-outline">
        <div className="section-outline-header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2>Student Progress</h2>
            <p>Track reading progress for all students</p>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--border)' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Not Started</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#6b7280' }}>{statusCounts.not_started}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Reading</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{statusCounts.reading}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>Completed</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{statusCounts.completed}</div>
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Sort:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            >
              <option value="progress">By Progress (Highest First)</option>
              <option value="name">By Name</option>
              <option value="status">By Status</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.875rem', marginRight: '0.5rem' }}>Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              style={{
                padding: '0.5rem',
                border: '1px solid var(--border)',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
              }}
            >
              <option value="all">All Students</option>
              <option value="not_started">Not Started</option>
              <option value="reading">Reading</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Student List */}
        {students.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
            <p>No students have started this book yet</p>
          </div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Status</th>
                  <th>Pages Read</th>
                  <th>Progress</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {sortedAndFiltered.map((student) => {
                  const progressPercent = (student.pages_read / book.total_pages) * 100;
                  const statusColor =
                    student.status === 'completed' ? '#10b981' : student.status === 'reading' ? '#3b82f6' : '#6b7280';

                  return (
                    <tr key={student.id}>
                      <td>
                        <strong>{student.full_name || 'N/A'}</strong>
                        <div className="table-muted">{student.email}</div>
                      </td>
                      <td>
                        <span
                          className={`badge badge-${
                            student.status === 'completed' ? 'approved' : student.status === 'reading' ? 'info' : 'pending'
                          }`}
                        >
                          {student.status === 'not_started' ? 'Not Started' : student.status === 'reading' ? 'Reading' : 'Completed'}
                        </span>
                      </td>
                      <td>
                        <strong>{student.pages_read}</strong> / {book.total_pages}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div
                            style={{
                              width: '80px',
                              height: '4px',
                              backgroundColor: '#e0e0e0',
                              borderRadius: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                height: '100%',
                                width: `${Math.min(progressPercent, 100)}%`,
                                backgroundColor: statusColor,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>
                            {progressPercent.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                        {new Date(student.last_updated).toLocaleDateString('en-GB')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
