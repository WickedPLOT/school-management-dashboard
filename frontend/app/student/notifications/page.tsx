'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type NotificationItem = {
  id: number;
  title: string;
  message: string;
  kind: string;
  action_url?: string;
  is_read: boolean;
  created_at: string;
};

export default function Page() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/profile/notifications')
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function markRead(id: number) {
    try {
      const updated = await apiFetch(`/profile/notifications/${id}/read`, { method: 'PATCH' });
      setItems((current) => current.map((item) => item.id === id ? updated : item));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Notifications</h1>
        <p>In-app alerts for issue updates, progress reviews, and other resident actions.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Alerts</h2>
            <p>Your most recent system notifications.</p>
          </div>
        </div>
        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
        {loading ? (
          <div className="empty-state"><p>Loading notifications...</p></div>
        ) : items.length === 0 ? (
          <div className="empty-state"><p>No notifications yet.</p></div>
        ) : (
          <div className="review-stack">
            {items.map((item) => (
              <article key={item.id} className={`review-card ${item.is_read ? '' : 'highlight-card'}`}>
                <div className="review-card-head">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{new Date(item.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <span className={`badge badge-${item.is_read ? 'approved' : 'pending'}`}>{item.is_read ? 'read' : 'new'}</span>
                </div>
                <p className="review-details">{item.message}</p>
                <div className="event-actions">
                  {!item.is_read ? (
                    <button type="button" className="btn-outline" onClick={() => markRead(item.id)}>
                      Mark Read
                    </button>
                  ) : null}
                  {item.action_url ? (
                    <Link href={item.action_url} className="btn-outline">
                      Open
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
