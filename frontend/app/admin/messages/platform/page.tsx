'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Recipient = {
  id: number;
  email: string;
  role: 'student' | 'brothers_admin' | 'sisters_admin' | 'super_admin';
  section: 'brothers' | 'sisters';
  full_name?: string;
};

type Mode = 'direct' | 'broadcast';
type Audience = 'students' | 'admins' | 'all';

export default function Page() {
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [mode, setMode] = useState<Mode>('broadcast');
  const [audience, setAudience] = useState<Audience>('all');
  const [recipientUserId, setRecipientUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch('/admin/messages/platform/recipients')
      .then(setRecipients)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const recipientCounts = useMemo(() => ({
    students: recipients.filter((item) => item.role === 'student').length,
    admins: recipients.filter((item) => item.role !== 'student').length,
    all: recipients.length,
  }), [recipients]);

  async function sendPlatformMessage(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    try {
      const result = await apiFetch('/admin/messages/platform', {
        method: 'POST',
        body: JSON.stringify({ mode, audience, recipient_user_id: recipientUserId, title, message }),
      });
      setSuccess(`Platform message sent to ${result.recipient_count} recipient(s).`);
      setTitle('');
      setMessage('');
      setRecipientUserId('');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Platform Messages</h1>
        <p>Send messages inside the platform to one student/admin or broadcast to everyone in scope.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>In-App Message</h2>
            <p>Recipients receive this in their notifications area.</p>
          </div>
        </div>

        <form onSubmit={sendPlatformMessage} className="form-stack" style={{ padding: '1rem' }}>
          <div className="stats-grid">
            <div className="stat-card"><div><h3>{loading ? '-' : recipientCounts.students}</h3><p>Students</p></div></div>
            <div className="stat-card"><div><h3>{loading ? '-' : recipientCounts.admins}</h3><p>Admins</p></div></div>
            <div className="stat-card"><div><h3>{loading ? '-' : recipientCounts.all}</h3><p>Total platform users</p></div></div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label>Message Type</label>
              <select value={mode} onChange={(e) => setMode(e.target.value as Mode)}>
                <option value="broadcast">Broadcast</option>
                <option value="direct">One Recipient</option>
              </select>
            </div>

            {mode === 'broadcast' ? (
              <div className="field">
                <label>Broadcast Audience</label>
                <select value={audience} onChange={(e) => setAudience(e.target.value as Audience)}>
                  <option value="all">Students and Admins</option>
                  <option value="students">Students only</option>
                  <option value="admins">Admins only</option>
                </select>
              </div>
            ) : (
              <div className="field">
                <label>Recipient</label>
                <select value={recipientUserId} onChange={(e) => setRecipientUserId(e.target.value)}>
                  <option value="">Select student or admin</option>
                  {recipients.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name || item.email} - {item.role.replace('_', ' ')} / {item.section}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="field">
            <label>Title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Important announcement" />
          </div>

          <div className="field">
            <label>Message</label>
            <textarea rows={7} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type the platform message..." />
          </div>

          {error ? <div className="error-msg">{error}</div> : null}
          {success ? <div className="success-msg">{success}</div> : null}

          <button type="submit" className="btn-primary" disabled={sending || loading}>
            {sending ? 'Sending...' : 'Send Platform Message'}
          </button>
        </form>
      </section>
    </div>
  );
}
