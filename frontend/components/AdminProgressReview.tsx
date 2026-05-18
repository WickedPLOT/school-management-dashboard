'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

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
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [trackFilter, setTrackFilter] = useState(defaultTrack);
  const [drafts, setDrafts] = useState<Record<number, { admin_note: string; progress_score: string; review_status: 'submitted' | 'reviewed' }>>({});

  async function load() {
    setLoading(true);
    setError('');
    try {
      const suffix = trackFilter === 'all' ? '' : `?track=${trackFilter}`;
      const data = await apiFetch(`/admin/progress/updates${suffix}`);
      setUpdates(data);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [trackFilter]);

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
        ) : updates.length === 0 ? (
          <div className="empty-state"><p>No updates submitted yet.</p></div>
        ) : (
          <div className="review-stack">
            {updates.map((item) => {
              const draft = getDraft(item);
              return (
                <article key={item.id} className="review-card">
                  <div className="review-card-head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.full_name || item.email} · {item.track} · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`badge badge-${item.review_status === 'reviewed' ? 'approved' : 'pending'}`}>
                      {item.review_status}
                    </span>
                  </div>

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
                    <label>Admin Note</label>
                    <textarea rows={3} value={draft.admin_note} onChange={(e) => updateDraft(item.id, 'admin_note', e.target.value)} placeholder="Feedback or follow-up note" />
                  </div>

                  <div className="event-actions">
                    <button type="button" className="btn-primary" style={{ width: 'auto' }} disabled={savingId === item.id} onClick={() => saveReview(item)}>
                      {savingId === item.id ? 'Saving...' : 'Save Review'}
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
