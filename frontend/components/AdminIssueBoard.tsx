'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type IssueStatus = 'pending' | 'inprogress' | 'resolved';

type IssueItem = {
  id: number;
  title: string;
  category: string;
  location?: string;
  description: string;
  attachment_name?: string;
  attachment_data?: string;
  status: IssueStatus;
  admin_note?: string;
  created_at: string;
  updated_at: string;
  full_name?: string;
  email: string;
  assigned_to_email?: string;
};

export default function AdminIssueBoard({
  statusFilter,
  title,
  description,
}: {
  statusFilter: 'all' | IssueStatus;
  title: string;
  description: string;
}) {
  const [issues, setIssues] = useState<IssueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<number, { status: IssueStatus; admin_note: string }>>({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const suffix = statusFilter === 'all' ? '' : `?status=${statusFilter}`;
      const data = await apiFetch(`/admin/issues/reports${suffix}`);
      setIssues(data);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [statusFilter]);

  function getDraft(item: IssueItem) {
    return drafts[item.id] || { status: item.status, admin_note: item.admin_note || '' };
  }

  function updateDraft(id: number, key: 'status' | 'admin_note', value: string) {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...getDraft(issues.find((entry) => entry.id === id)!),
        [key]: value,
      },
    }));
  }

  async function saveIssue(item: IssueItem) {
    const draft = getDraft(item);
    setSavingId(item.id);
    try {
      const updated = await apiFetch(`/admin/issues/reports/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setIssues((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Issue Queue</h2>
            <p>Resident-submitted facility and welfare issues, with images and follow-up notes.</p>
          </div>
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}

        {loading ? (
          <div className="empty-state"><p>Loading issues...</p></div>
        ) : issues.length === 0 ? (
          <div className="empty-state"><p>No issues found for this status.</p></div>
        ) : (
          <div className="review-stack">
            {issues.map((item) => {
              const draft = getDraft(item);
              return (
                <article key={item.id} className="review-card">
                  <div className="review-card-head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.full_name || item.email} · {item.category} · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`badge badge-${item.status === 'resolved' ? 'approved' : item.status === 'inprogress' ? 'partial' : 'pending'}`}>
                      {item.status}
                    </span>
                  </div>

                  <div className="review-meta-grid">
                    <div><strong>Category</strong><span>{item.category}</span></div>
                    <div><strong>Location</strong><span>{item.location || '—'}</span></div>
                    <div><strong>Assigned</strong><span>{item.assigned_to_email || 'Pending'}</span></div>
                    <div><strong>Updated</strong><span>{new Date(item.updated_at).toLocaleDateString('en-GB')}</span></div>
                  </div>

                  <p className="review-details">{item.description}</p>
                  {item.attachment_data ? (
                    <a className="resource-link" href={item.attachment_data} target="_blank" rel="noreferrer">
                      View attachment {item.attachment_name ? `(${item.attachment_name})` : ''}
                    </a>
                  ) : null}

                  <div className="field">
                    <label>Status</label>
                    <select value={draft.status} onChange={(e) => updateDraft(item.id, 'status', e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="inprogress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div className="field">
                    <label>Admin Note</label>
                    <textarea rows={3} value={draft.admin_note} onChange={(e) => updateDraft(item.id, 'admin_note', e.target.value)} placeholder="Resolution steps or assignment note" />
                  </div>

                  <div className="event-actions">
                    <button type="button" className="btn-primary" style={{ width: 'auto' }} disabled={savingId === item.id} onClick={() => saveIssue(item)}>
                      {savingId === item.id ? 'Saving...' : 'Save Update'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
