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
  const [selectedIssue, setSelectedIssue] = useState<IssueItem | null>(null);
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
    const issue = issues.find((entry) => entry.id === id) || selectedIssue;
    if (!issue) return;
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...getDraft(issue),
        [key]: value,
      },
    }));
  }

  async function saveIssue(item: IssueItem) {
    const draft = getDraft(item);
    setSavingId(item.id);
    setError('');
    try {
      const updated = await apiFetch(`/admin/issues/reports/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setIssues((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...updated } : entry));
      setSelectedIssue((current) => current?.id === item.id ? { ...current, ...updated } : current);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  function statusBadge(status: IssueStatus) {
    return `badge badge-${status === 'resolved' ? 'approved' : status === 'inprogress' ? 'partial' : 'pending'}`;
  }

  const selectedDraft = selectedIssue ? getDraft(selectedIssue) : null;

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
            <p>Compact list of resident-submitted facility and welfare issues.</p>
          </div>
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}

        {loading ? (
          <div className="empty-state"><p>Loading issues...</p></div>
        ) : issues.length === 0 ? (
          <div className="empty-state"><p>No issues found for this status.</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Issue</th>
                  <th>Resident</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="table-muted">Reported {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    </td>
                    <td>{item.full_name || item.email}</td>
                    <td>{item.category}</td>
                    <td>{item.location || '—'}</td>
                    <td><span className={statusBadge(item.status)}>{item.status}</span></td>
                    <td>{new Date(item.updated_at).toLocaleDateString('en-GB')}</td>
                    <td>
                      <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedIssue(item)}>
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedIssue && selectedDraft ? (
        <div className="page-modal-backdrop" onClick={() => setSelectedIssue(null)}>
          <div className="page-modal issue-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-outline-header">
              <div>
                <h2>{selectedIssue.title}</h2>
                <p>{selectedIssue.full_name || selectedIssue.email} · {selectedIssue.category}</p>
              </div>
              <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedIssue(null)}>Close</button>
            </div>

            <div className="review-stack">
              <div className="review-meta-grid">
                <div><strong>Status</strong><span><span className={statusBadge(selectedIssue.status)}>{selectedIssue.status}</span></span></div>
                <div><strong>Location</strong><span>{selectedIssue.location || '—'}</span></div>
                <div><strong>Assigned</strong><span>{selectedIssue.assigned_to_email || 'Pending'}</span></div>
                <div><strong>Updated</strong><span>{new Date(selectedIssue.updated_at).toLocaleDateString('en-GB')}</span></div>
              </div>

              <div>
                <h3 style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}>Issue Details</h3>
                <p className="review-details">{selectedIssue.description}</p>
              </div>

              {selectedIssue.attachment_data ? (
                <a className="resource-link" href={selectedIssue.attachment_data} target="_blank" rel="noreferrer">
                  View attachment {selectedIssue.attachment_name ? `(${selectedIssue.attachment_name})` : ''}
                </a>
              ) : null}

              <div className="field">
                <label>Status</label>
                <select value={selectedDraft.status} onChange={(e) => updateDraft(selectedIssue.id, 'status', e.target.value)}>
                  <option value="pending">Pending</option>
                  <option value="inprogress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>

              <div className="field">
                <label>Admin Note</label>
                <textarea rows={4} value={selectedDraft.admin_note} onChange={(e) => updateDraft(selectedIssue.id, 'admin_note', e.target.value)} placeholder="Resolution steps or assignment note" />
              </div>

              <div className="event-actions">
                <button type="button" className="btn-primary" style={{ width: 'auto' }} disabled={savingId === selectedIssue.id} onClick={() => saveIssue(selectedIssue)}>
                  {savingId === selectedIssue.id ? 'Saving...' : 'Save Update'}
                </button>
                <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setSelectedIssue(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
