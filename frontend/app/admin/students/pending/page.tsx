'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type User = {
  id: number;
  email: string;
  section: string;
  status: string;
  created_at: string;
  full_name?: string;
  gender?: string;
  institution?: string;
  course?: string;
};

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

export default function PendingApprovalsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<number[]>([]);

  async function load() {
    try {
      setUsers(await apiFetch('/admin/pending-users'));
    } catch (e) {
      if (e instanceof Error) setError(e.message);
      else setError('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }

  async function action(id: number, type: 'approve' | 'reject') {
    try {
      await apiFetch(`/admin/${type}/${id}`, { method: 'PATCH' });
      setUsers((current) => current.filter((user) => user.id !== id));
      setSelected((current) => current.filter((value) => value !== id));
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }

  async function bulkAction(type: 'approve' | 'reject') {
    if (!selected.length) return;
    try {
      await Promise.all(selected.map((id) => apiFetch(`/admin/${type}/${id}`, { method: 'PATCH' })));
      setUsers((current) => current.filter((user) => !selected.includes(user.id)));
      setSelected([]);
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const allSelected = users.length > 0 && selected.length === users.length;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  function toggleSelected(id: number) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id]
    );
  }

  function toggleAll() {
    setSelected(allSelected ? [] : users.map((user) => user.id));
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Pending Approvals</h1>
        <p>Table layout with status column and bulk action toolbar</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Pending Approvals</h2>
          </div>
          <div className="toolbar-chip">
            <strong>{loading ? '—' : users.length}</strong>
            <span>Awaiting Review</span>
          </div>
        </div>

        <div style={{ padding: '1rem' }}>
          <div className="soft-toolbar">
            <label className="toolbar-select">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              <span>Select all</span>
            </label>
            <div className="toolbar-actions">
              <button className="btn-soft-approve" disabled={!selected.length} onClick={() => bulkAction('approve')}>
                ✓ Approve All
              </button>
              <button className="btn-soft-reject" disabled={!selected.length} onClick={() => bulkAction('reject')}>
                × Reject All
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="empty-state"><p>Loading...</p></div>}
        {error && <div style={{ padding: '0 1rem 1rem' }}><div className="error-msg">{error}</div></div>}
        {!loading && !error && users.length === 0 && (
          <div className="empty-state"><p>No pending registrations at this time.</p></div>
        )}

        {!loading && !error && users.length > 0 && (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th style={{ width: 36 }} />
                  <th>Student</th>
                  <th>Institution</th>
                  <th>Course</th>
                  <th>Registered</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const displayName = user.full_name || user.email;
                  return (
                    <tr key={user.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedSet.has(user.id)}
                          onChange={() => toggleSelected(user.id)}
                          style={{ accentColor: 'var(--green)' }}
                        />
                      </td>
                      <td>
                        <div className="pending-student-cell">
                          <div className="pending-student-avatar">{initialsOf(displayName)}</div>
                          <div className="pending-student-meta">
                            <strong>{displayName}</strong>
                            <span>{user.email}</span>
                          </div>
                        </div>
                      </td>
                      <td>{user.institution || '—'}</td>
                      <td>{user.course || '—'}</td>
                      <td className="table-muted">
                        {new Date(user.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button className="mini-action approve" onClick={() => action(user.id, 'approve')}>
                            Approve
                          </button>
                          <button className="mini-action reject" onClick={() => action(user.id, 'reject')}>
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
