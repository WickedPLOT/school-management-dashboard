'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type RoomState = 'available' | 'full' | 'partial' | 'empty';

type Building = {
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
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<number | null>(null);
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
      setBuildings(data);
      const nextBuildingId = activeBuilding || data[0]?.id || null;
      setActiveBuilding(nextBuildingId);
      const active = data.find((item: Building) => item.id === nextBuildingId) || data[0];
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

  const visibleBuildings = user?.role === 'super_admin' && sectionView !== 'all'
    ? buildings.filter((entry) => entry.section_scope === sectionView)
    : buildings;

  const building = visibleBuildings.find((entry) => entry.id === activeBuilding) || visibleBuildings[0] || null;
  const room = building?.rooms.find((entry) => entry.id === selectedRoomId) || null;

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
        <p>Assign unplaced students into rooms without changing the dormitory overview page.</p>
      </div>

      {error ? <div className="error-msg">{error}</div> : null}

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Assignment Workspace</h2>
            <p>{user?.role === 'super_admin' ? 'Assign rooms across both brothers and sisters sections.' : 'Select a building and room, then assign or remove students.'}</p>
          </div>
        </div>

        {loading ? <div className="empty-state"><p>Loading assignments...</p></div> : (
          <>
            {user?.role === 'super_admin' ? (
              <div className="legend-row">
                <button type="button" className="btn-outline" style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('all'); setActiveBuilding(null); }}>
                  Both Sections
                </button>
                <button type="button" className="btn-outline" style={{ background: sectionView === 'brothers' ? 'var(--green)' : 'white', color: sectionView === 'brothers' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('brothers'); setActiveBuilding(null); }}>
                  Brothers
                </button>
                <button type="button" className="btn-outline" style={{ background: sectionView === 'sisters' ? 'var(--green)' : 'white', color: sectionView === 'sisters' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('sisters'); setActiveBuilding(null); }}>
                  Sisters
                </button>
              </div>
            ) : null}

            <div className="legend-row">
              {visibleBuildings.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="btn-outline"
                  style={{
                    background: entry.id === activeBuilding ? 'var(--green)' : 'white',
                    color: entry.id === activeBuilding ? 'white' : 'var(--green)',
                    borderColor: entry.id === activeBuilding ? 'var(--green)' : '#b9d4c1',
                  }}
                  onClick={() => {
                    setActiveBuilding(entry.id);
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
                  {building?.rooms.map((entry) => (
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

                <div className="review-stack">
                  {room?.residents.length ? room.residents.map((resident) => (
                    <article key={resident.id} className="review-card">
                      <div className="review-card-head">
                        <div>
                          <h3>{resident.full_name || resident.email}</h3>
                          <p>{resident.email}</p>
                        </div>
                        <button type="button" className="btn-danger-outline" onClick={() => unassignStudent(resident.id)} disabled={saving}>
                          Remove
                        </button>
                      </div>
                    </article>
                  )) : <div className="empty-state"><p>No residents in this room yet.</p></div>}
                </div>
              </section>

              <section className="section-outline">
                <div className="section-outline-header">
                  <div>
                    <h2>Unassigned Students</h2>
                    <p>{user?.role === 'super_admin' ? 'Unassigned students for the selected building section.' : 'Students in this section who are not yet placed into a room.'}</p>
                  </div>
                </div>

                <div className="review-stack">
                  {building?.unassigned.length ? building.unassigned.map((student) => (
                    <article key={student.id} className="review-card">
                      <div className="review-card-head">
                        <div>
                          <h3>{student.full_name || student.email}</h3>
                          <p>{student.institution || student.course || student.email}</p>
                        </div>
                        <button type="button" className="btn-primary" style={{ width: 'auto' }} onClick={() => assignStudent(student.id)} disabled={saving || !room || (room.occupied >= room.capacity)}>
                          Assign
                        </button>
                      </div>
                    </article>
                  )) : <div className="empty-state"><p>No unassigned students in this building section.</p></div>}
                </div>
              </section>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
