'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type RoomInfo = {
  building_name?: string;
  room_name?: string;
  capacity?: number;
  manager_name?: string;
  assigned_at?: string;
};

export default function Page() {
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/profile/room')
      .then(setRoom)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>My Room & Accommodation</h1>
        <p>Your current room assignment and accommodation details.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Current Assignment</h2>
            <p>Managed by the admin accommodation team.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading room information...</p></div>
        ) : error ? (
          <div style={{ padding: '1rem' }}><div className="error-msg">{error}</div></div>
        ) : !room?.room_name ? (
          <div className="empty-state"><p>You have not been assigned a room yet.</p></div>
        ) : (
          <div className="review-stack">
            <article className="review-card">
              <div className="review-card-head">
                <div>
                  <h3>{room.room_name}</h3>
                  <p>{room.building_name}</p>
                </div>
                <span className="badge badge-approved">Assigned</span>
              </div>
              <div className="review-meta-grid">
                <div><strong>Building</strong><span>{room.building_name || '—'}</span></div>
                <div><strong>Capacity</strong><span>{room.capacity || '—'} students</span></div>
                <div><strong>Manager</strong><span>{room.manager_name || '—'}</span></div>
                <div><strong>Assigned</strong><span>{room.assigned_at ? new Date(room.assigned_at).toLocaleDateString('en-GB') : '—'}</span></div>
              </div>
            </article>
          </div>
        )}
      </section>
    </div>
  );
}
