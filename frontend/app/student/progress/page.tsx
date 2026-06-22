'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type StudentUpdate = {
  id: number;
  track: 'academic' | 'religious' | 'activity';
  title: string;
  summary: string;
  details?: string;
  progress_score?: string | number;
  review_status: 'submitted' | 'reviewed';
  admin_note?: string;
  created_at: string;
};

const DEFAULT_FORM = {
  track: 'academic' as StudentUpdate['track'],
  title: '',
  summary: '',
  details: '',
  progress_score: '',
};

export default function Page() {
  const [updates, setUpdates] = useState<StudentUpdate[]>([]);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch('/profile/updates')
      .then((data) => setUpdates(data))
      .catch((err) => { if (err instanceof Error) setError(err.message); })
      .finally(() => setLoading(false));
  }, []);

  const summary = useMemo(() => ({
    total: updates.length,
    reviewed: updates.filter((item) => item.review_status === 'reviewed').length,
    pending: updates.filter((item) => item.review_status === 'submitted').length,
  }), [updates]);

  async function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const created = await apiFetch('/profile/updates', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          progress_score: form.progress_score ? Number(form.progress_score) : null,
        }),
      });
      setUpdates((current) => [created, ...current]);
      setForm(DEFAULT_FORM);
      setSuccess('Update submitted for admin review.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Progress Updates</h1>
        <p>Submit academic, religious, and activity updates for periodic review.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><h3>{summary.total}</h3><p>Total updates</p></div></div>
        <div className="stat-card"><div><h3>{summary.pending}</h3><p>Awaiting review</p></div></div>
        <div className="stat-card"><div><h3>{summary.reviewed}</h3><p>Reviewed by admin</p></div></div>
      </div>

      <div className="settings-grid">
        <section className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>Submit Update</h2>
              <p>Share current progress, recent study activity, or religious development.</p>
            </div>
          </div>

          <form onSubmit={submitUpdate} className="form-stack" style={{ padding: '1rem' }}>
            <div className="field-grid">
              <div className="field">
                <label>Track</label>
                <select value={form.track} onChange={(e) => setForm((current) => ({ ...current, track: e.target.value as StudentUpdate['track'] }))}>
                  <option value="academic">Academic</option>
                  <option value="religious">Religious</option>
                  <option value="activity">Activity</option>
                </select>
              </div>
              <div className="field">
                <label>Progress Score</label>
                <input value={form.progress_score} onChange={(e) => setForm((current) => ({ ...current, progress_score: e.target.value }))} placeholder="Optional score or percentage" />
              </div>
            </div>
            <div className="field">
              <label>Title</label>
              <input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} placeholder="Mid-semester revision progress" />
            </div>
            <div className="field">
              <label>Summary</label>
              <textarea rows={3} value={form.summary} onChange={(e) => setForm((current) => ({ ...current, summary: e.target.value }))} placeholder="Short summary of what changed this week" />
            </div>
            <div className="field">
              <label>Details</label>
              <textarea rows={5} value={form.details} onChange={(e) => setForm((current) => ({ ...current, details: e.target.value }))} placeholder="Subjects, revision plan, Qur'an portion, or activities attended" />
            </div>
            {error ? <div className="error-msg">{error}</div> : null}
            {success ? <div className="success-msg">{success}</div> : null}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Submitting...' : 'Submit Update'}
            </button>
          </form>
        </section>

        <section className="section-outline">
          <div className="section-outline-header">
            <div>
              <h2>Recent Updates</h2>
              <p>Your submission history and admin feedback.</p>
            </div>
          </div>

          {loading ? (
            <div className="empty-state"><p>Loading updates...</p></div>
          ) : updates.length === 0 ? (
            <div className="empty-state"><p>No updates submitted yet.</p></div>
          ) : (
            <div className="review-stack">
              {updates.map((item) => (
                <article key={item.id} className="review-card">
                  <div className="review-card-head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.track} · {new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                    <span className={`badge badge-${item.review_status === 'reviewed' ? 'approved' : 'pending'}`}>{item.review_status}</span>
                  </div>
                  <p className="review-details">{item.summary}</p>
                  {item.details ? <p className="review-details">{item.details}</p> : null}
                  <div className="review-meta-grid">
                    <div><strong>Score</strong><span>{item.progress_score ?? '—'}</span></div>
                    <div><strong>Comment</strong><span>{item.admin_note || 'No note yet'}</span></div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
