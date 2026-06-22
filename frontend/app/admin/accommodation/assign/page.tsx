'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type RoomState = 'available' | 'full' | 'partial' | 'empty';

function bedLabel(index: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[index] || `Bed ${index + 1}`;
}

type Floor = {
  id: number;
  name: string;
  manager_name?: string;
  section_scope: 'brothers' | 'sisters';
  rooms: Array<{
    id: number;
    name: string;
    capacity: number;
    occupied: number;
    state: RoomState;
    residents: Array<{ id: number; email: string; full_name?: string }>;
  }>;
  unassigned: Array<{ id: number; full_name?: string; email: string; institution?: string; course?: string }>;
};

export default function Page() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [sectionView, setSectionView] = useState<'all' | 'brothers' | 'sisters'>('all');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/admin/accommodation/overview');
      setFloors(data);
      const nextFloorId = activeFloor || data[0]?.id || null;
      setActiveFloor(nextFloorId);
      const active = data.find((item: Floor) => item.id === nextFloorId) || data[0];
      setSelectedRoomId((current) => current || active?.rooms[0]?.id || null);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
  }, []);

  const visibleFloors = user?.role === 'super_admin' && sectionView !== 'all'
    ? floors.filter((entry) => entry.section_scope === sectionView)
    : floors;

  const floor = visibleFloors.find((entry) => entry.id === activeFloor) || visibleFloors[0] || null;
  const room = floor?.rooms.find((entry) => entry.id === selectedRoomId) || null;

  async function assignStudent(userId: number) {
    if (!room) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/admin/accommodation/assignments', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, room_id: room.id }),
      });
      await load();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function unassignStudent(userId: number) {
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/admin/accommodation/assignments/${userId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Room Assignments</h1>
        <p>Assign unplaced students into the fixed floor-based room layout.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Assignment Workspace</h2>
            <p>{user?.role === 'super_admin' ? 'Assign rooms across brothers and sisters floor plans.' : 'Select a floor and room, then assign or remove students.'}</p>
          </div>
        </div>

        {loading ? <div className="empty-state"><p>Loading assignments...</p></div> : (
          <>
            {user?.role === 'super_admin' ? (
              <div className="legend-row">
                <button type="button" className="btn-outline" style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('all'); setActiveFloor(null); }}>
                  Both Sections
                </button>
                <button type="button" className="btn-outline" style={{ background: sectionView === 'brothers' ? 'var(--green)' : 'white', color: sectionView === 'brothers' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('brothers'); setActiveFloor(null); }}>
                  Brothers
                </button>
                <button type="button" className="btn-outline" style={{ background: sectionView === 'sisters' ? 'var(--green)' : 'white', color: sectionView === 'sisters' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('sisters'); setActiveFloor(null); }}>
                  Sisters
                </button>
              </div>
            ) : null}

            <div className="legend-row">
              {visibleFloors.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="btn-outline"
                  style={{
                    background: entry.id === floor?.id ? 'var(--green)' : 'white',
                    color: entry.id === floor?.id ? 'white' : 'var(--green)',
                    borderColor: entry.id === floor?.id ? 'var(--green)' : '#b9d4c1',
                  }}
                  onClick={() => {
                    setActiveFloor(entry.id);
                    setSelectedRoomId(entry.rooms[0]?.id || null);
                  }}
                >
                  {entry.name} {user?.role === 'super_admin' ? `· ${entry.section_scope}` : ''}
                </button>
              ))}
            </div>

            <div className="assignment-layout">
              <section className="section-outline">
                <div className="section-outline-header">
                  <div>
                    <h2>Target Room</h2>
                    <p>{room ? `${room.name} · ${room.occupied}/${room.capacity} occupied` : 'Select a room to assign into.'}</p>
                  </div>
                </div>
                <div className="legend-row">
                  {floor?.rooms.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className="btn-outline"
                      style={{
                        background: entry.id === selectedRoomId ? 'var(--green)' : 'white',
                        color: entry.id === selectedRoomId ? 'white' : 'var(--green)',
                      }}
                      onClick={() => setSelectedRoomId(entry.id)}
                    >
                      {entry.name}
                    </button>
                  ))}
                </div>

                <div className="room-bed-list assignment-bed-list">
                  {room ? Array.from({ length: room.capacity }).map((_, index) => {
                    const resident = room.residents[index];
                    return (
                      <div key={`${room.id}-${index}`} className={`room-bed-slot ${resident ? 'occupied' : 'free'}`}>
                        <span className="bed-label">{bedLabel(index)}</span>
                        {resident ? (
                          <>
                            <Link href={`/admin/profiles/${resident.id}`} className="student-name-link">{resident.full_name || resident.email}</Link>
                            <button type="button" className="btn-danger-outline" onClick={() => unassignStudent(resident.id)} disabled={saving}>Remove</button>
                          </>
                        ) : <span className="table-muted">Available bed</span>}
                      </div>
                    );
                  }) : <div className="empty-state"><p>Select a room first.</p></div>}
                </div>
              </section>

              <section className="section-outline">
                <div className="section-outline-header">
                  <div>
                    <h2>Unassigned Students</h2>
                    <p>{user?.role === 'super_admin' ? 'Unassigned students for the selected section floor plan.' : 'Students in this section who are not yet placed into a room.'}</p>
                  </div>
                </div>

                <div className="review-stack">
                  {floor?.unassigned.length ? floor.unassigned.map((student) => (
                    <article key={student.id} className="review-card">
                      <div className="review-card-head">
                        <div>
                          <h3><Link href={`/admin/profiles/${student.id}`} className="student-name-link">{student.full_name || student.email}</Link></h3>
                          <p>{student.institution || student.course || student.email}</p>
                        </div>
                        <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => assignStudent(student.id)} disabled={saving || !room || room.occupied >= room.capacity}>
                          Assign
                        </button>
                      </div>
                    </article>
                  )) : <div className="empty-state"><p>No unassigned students in this section.</p></div>}
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
