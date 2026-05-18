'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Audience = 'students' | 'parents' | 'both';
type Channel = 'sms' | 'email' | 'both';

type Summary = {
  total_students: string;
  sms_students: string;
  email_students: string;
  sms_parents: string;
  email_parents: string;
};

const AUDIENCE_LABELS: Record<Audience, string> = {
  students: 'Students',
  parents: 'Parents / Guardians',
  both: 'Students + Parents',
};

export default function BroadcastComposer({ defaultAudience }: { defaultAudience: Audience }) {
  const [audience, setAudience] = useState<Audience>(defaultAudience);
  const [channel, setChannel] = useState<Channel>('both');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch('/admin/messages/summary')
      .then((data) => setSummary(data.summary))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function sendBroadcast(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);

    try {
      const result = await apiFetch('/admin/messages/broadcast', {
        method: 'POST',
        body: JSON.stringify({ audience, channel, subject, message }),
      });
      setSuccess(
        `Broadcast sent with status "${result.status}". Success: ${result.success_count}, Failed: ${result.failure_count}.`
      );
      setMessage('');
      setSubject('');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSending(false);
    }
  }

  const recipientHint = summary
    ? {
        students: `Students with SMS: ${summary.sms_students}, Email: ${summary.email_students}`,
        parents: `Parents with SMS: ${summary.sms_parents}, Email: ${summary.email_parents}`,
        both: `Students/parents available: SMS ${Number(summary.sms_students) + Number(summary.sms_parents)}, Email ${Number(summary.email_students) + Number(summary.email_parents)}`,
      }[audience]
    : 'Loading recipient availability...';

  return (
    <div className="section-shell">
      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Broadcast Message</h2>
            <p>Official communication for students, parents, or both</p>
          </div>
        </div>

        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          <div className="stats-grid" style={{ marginBottom: '1rem' }}>
            <div className="stat-card">
              <div>
                <h3>{loading || !summary ? '—' : summary.sms_students}</h3>
                <p>Students with SMS</p>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <h3>{loading || !summary ? '—' : summary.email_students}</h3>
                <p>Students with Email</p>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <h3>{loading || !summary ? '—' : summary.sms_parents}</h3>
                <p>Parents with SMS</p>
              </div>
            </div>
            <div className="stat-card">
              <div>
                <h3>{loading || !summary ? '—' : summary.email_parents}</h3>
                <p>Parents with Email</p>
              </div>
            </div>
          </div>

          <form onSubmit={sendBroadcast} className="form-stack">
            <div className="form-grid">
              <div className="field">
                <label>Audience</label>
                <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                  <option value="students">Students</option>
                  <option value="parents">Parents / Guardians</option>
                  <option value="both">Students and Parents</option>
                </select>
              </div>

              <div className="field">
                <label>Channel</label>
                <select value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
                  <option value="sms">SMS only</option>
                  <option value="email">Email only</option>
                  <option value="both">Email and SMS</option>
                </select>
              </div>
            </div>

            {(channel === 'email' || channel === 'both') && (
              <div className="field">
                <label>Email Subject</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Official notice subject" />
              </div>
            )}

            <div className="field">
              <label>Broadcast Message</label>
              <textarea
                rows={8}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type the message to be sent..."
              />
            </div>

            <div className="soft-toolbar">
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--green)' }}>
                  Sending to: {AUDIENCE_LABELS[audience]}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--muted)' }}>{recipientHint}</div>
              </div>
              <div className="toolbar-actions">
                <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '1.25rem' }} disabled={sending}>
                  {sending ? 'Sending...' : 'Send Broadcast'}
                </button>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {success && <div className="success-msg">{success}</div>}
          </form>
        </div>
      </div>
    </div>
  );
}
