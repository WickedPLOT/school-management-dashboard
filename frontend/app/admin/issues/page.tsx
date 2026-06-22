'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

interface IssueReport {
  id: number;
  user_id: number;
  title: string;
  category: string;
  location?: string;
  description: string;
  status: 'pending' | 'inprogress' | 'resolved';
  email: string;
  full_name?: string;
  phone?: string;
  assigned_to_email?: string;
  admin_note?: string;
  created_at: string;
  updated_at: string;
}

interface IssueStats {
  pending: number;
  inprogress: number;
  resolved: number;
  total: number;
}

export default function IssuesPage() {
  const [issues, setIssues] = useState<IssueReport[]>([]);
  const [stats, setStats] = useState<IssueStats>({ pending: 0, inprogress: 0, resolved: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'inprogress' | 'resolved'>('all');
  const [selectedIssue, setSelectedIssue] = useState<IssueReport | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: 'pending', admin_note: '' });

  async function loadIssues(status: string = 'all') {
    try {
      setLoading(true);
      setError('');
      const data = await apiFetch(`/admin/issues/reports?status=${status}`);
      setIssues(data);

      // Calculate stats
      const allIssues = await apiFetch('/admin/issues/reports?status=all');
      const counts = {
        pending: allIssues.filter((i: IssueReport) => i.status === 'pending').length,
        inprogress: allIssues.filter((i: IssueReport) => i.status === 'inprogress').length,
        resolved: allIssues.filter((i: IssueReport) => i.status === 'resolved').length,
        total: allIssues.length,
      };
      setStats(counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issues');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssues();
  }, []);

  async function updateIssue(issueId: number) {
    setUpdating(true);
    try {
      await apiFetch(`/admin/issues/reports/${issueId}`, {
        method: 'PATCH',
        body: JSON.stringify(updateForm),
      });
      setSelectedIssue(null);
      loadIssues(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setUpdating(false);
    }
  }

  const handleFilterClick = (newFilter: typeof filter) => {
    setFilter(newFilter);
    loadIssues(newFilter);
  };

  const filteredIssues = filter === 'all' ? issues : issues.filter((i) => i.status === filter);

  // SVG Pie Chart Component
  const PieChart = ({ pending, inprogress, resolved }: { pending: number; inprogress: number; resolved: number }) => {
    const total = pending + inprogress + resolved;
    if (total === 0) {
      return <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>No issues yet</div>;
    }

    const pendingPercent = (pending / total) * 100;
    const inprogressPercent = (inprogress / total) * 100;
    const resolvedPercent = (resolved / total) * 100;

    const pendingDeg = (pending / total) * 360;
    const inprogressDeg = (inprogress / total) * 360;

    const conic = `conic-gradient(
      #ef4444 0deg ${pendingDeg}deg,
      #f59e0b ${pendingDeg}deg ${pendingDeg + inprogressDeg}deg,
      #10b981 ${pendingDeg + inprogressDeg}deg 360deg
    )`;

    return (
      <div style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div
            style={{
              width: '200px',
              height: '200px',
              borderRadius: '50%',
              background: conic,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <div
              style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                backgroundColor: 'white',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div style={{ fontSize: '1.875rem', fontWeight: 700 }}>{total}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Total Issues</div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
            <span style={{ fontSize: '0.875rem' }}>
              Pending: <strong>{pending}</strong> ({pendingPercent.toFixed(1)}%)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
            <span style={{ fontSize: '0.875rem' }}>
              In Progress: <strong>{inprogress}</strong> ({inprogressPercent.toFixed(1)}%)
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#10b981' }} />
            <span style={{ fontSize: '0.875rem' }}>
              Resolved: <strong>{resolved}</strong> ({resolvedPercent.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Issue Reports</h1>
        <p>Manage student issue reports and track resolution status</p>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem', marginBottom: '2rem' }}>
        {/* Stats Chart */}
        <div className="section-outline">
          <div className="section-outline-header">
            <h2>Status Overview</h2>
          </div>
          <PieChart pending={stats.pending} inprogress={stats.inprogress} resolved={stats.resolved} />
        </div>

        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
          <div className="section-outline" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Pending</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#ef4444', marginBottom: '0.5rem' }}>
              {stats.pending}
            </div>
            <button
              className="btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.5rem' }}
              onClick={() => handleFilterClick('pending')}
            >
              View All
            </button>
          </div>

          <div className="section-outline" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>In Progress</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.5rem' }}>
              {stats.inprogress}
            </div>
            <button
              className="btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.5rem' }}
              onClick={() => handleFilterClick('inprogress')}
            >
              View All
            </button>
          </div>

          <div className="section-outline" style={{ padding: '1.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Resolved</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, color: '#10b981', marginBottom: '0.5rem' }}>
              {stats.resolved}
            </div>
            <button
              className="btn-outline"
              style={{ fontSize: '0.75rem', padding: '0.5rem' }}
              onClick={() => handleFilterClick('resolved')}
            >
              View All
            </button>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
        {(['all', 'pending', 'inprogress', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => handleFilterClick(f)}
            className={filter === f ? 'btn-primary' : 'btn-outline'}
            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
          >
            {f.charAt(0).toUpperCase() + f.slice(1).replace('inprogress', 'In Progress')} ({f === 'all' ? stats.total : stats[f as keyof Omit<IssueStats, 'total'>]})
          </button>
        ))}
      </div>

      {/* Issues List */}
      {loading ? (
        <div className="section-outline" style={{ padding: '2rem', textAlign: 'center' }}>
          <p>Loading issues...</p>
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="section-outline" style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)' }}>
          <p>No issues found in this status</p>
        </div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Student</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filteredIssues.map((issue) => (
                <tr key={issue.id}>
                  <td>
                    <strong>{issue.title}</strong>
                    {issue.location && (
                      <div className="table-muted" style={{ fontSize: '0.875rem' }}>
                        Location: {issue.location}
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ textTransform: 'capitalize', fontSize: '0.875rem' }}>{issue.category}</span>
                  </td>
                  <td>
                    <div>
                      <strong>{issue.full_name || 'N/A'}</strong>
                      <div className="table-muted">{issue.email}</div>
                    </div>
                  </td>
                  <td>
                    <span
                      className={`badge badge-${
                        issue.status === 'pending' ? 'pending' : issue.status === 'inprogress' ? 'info' : 'approved'
                      }`}
                    >
                      {issue.status === 'inprogress' ? 'In Progress' : issue.status.charAt(0).toUpperCase() + issue.status.slice(1)}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                    {new Date(issue.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                    {new Date(issue.updated_at).toLocaleDateString('en-GB')}
                  </td>
                  <td>
                    <button
                      className="btn-outline"
                      style={{ fontSize: '0.75rem', padding: '0.5rem 0.75rem' }}
                      onClick={() => {
                        setSelectedIssue(issue);
                        setUpdateForm({ status: issue.status, admin_note: issue.admin_note || '' });
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal */}
      {selectedIssue && (
        <div className="page-modal-backdrop" onClick={() => setSelectedIssue(null)}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="section-outline-header" style={{ marginBottom: '1rem' }}>
              <div>
                <h2>{selectedIssue.title}</h2>
                <p>{selectedIssue.category}</p>
              </div>
              <button className="btn-outline" onClick={() => setSelectedIssue(null)}>
                Close
              </button>
            </div>

            <div style={{ padding: '0 1rem' }}>
              {/* Student Info */}
              <div className="content-card" style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem' }}>Reported By</div>
                <div style={{ fontWeight: 600 }}>{selectedIssue.full_name || 'N/A'}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{selectedIssue.email}</div>
                {selectedIssue.phone && (
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>{selectedIssue.phone}</div>
                )}
              </div>

              {/* Issue Details */}
              <div className="content-card" style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                  Description
                </div>
                <p style={{ margin: 0 }}>{selectedIssue.description}</p>
              </div>

              {selectedIssue.location && (
                <div className="content-card" style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.5rem', fontWeight: 600 }}>
                    Location
                  </div>
                  <p style={{ margin: 0 }}>{selectedIssue.location}</p>
                </div>
              )}

              {/* Status Update Form */}
              <div className="content-card" style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: '#f9fafb' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--muted)', marginBottom: '0.75rem', fontWeight: 600 }}>
                  Update Status
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Status</label>
                    <select
                      value={updateForm.status}
                      onChange={(e) => setUpdateForm((f) => ({ ...f, status: e.target.value as any }))}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                      }}
                    >
                      <option value="pending">Pending</option>
                      <option value="inprogress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Admin Note</label>
                    <textarea
                      value={updateForm.admin_note}
                      onChange={(e) => setUpdateForm((f) => ({ ...f, admin_note: e.target.value }))}
                      rows={3}
                      placeholder="Add any notes about this issue..."
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        border: '1px solid var(--border)',
                        borderRadius: '0.375rem',
                        fontSize: '0.875rem',
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="btn-primary"
                      onClick={() => updateIssue(selectedIssue.id)}
                      disabled={updating}
                      style={{ flex: 1 }}
                    >
                      {updating ? 'Saving...' : 'Save Changes'}
                    </button>
                    <button
                      className="btn-outline"
                      onClick={() => setSelectedIssue(null)}
                      disabled={updating}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>
                <p>Created: {new Date(selectedIssue.created_at).toLocaleString('en-GB')}</p>
                <p>Updated: {new Date(selectedIssue.updated_at).toLocaleString('en-GB')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
