'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type RoomState = 'available' | 'full' | 'partial' | 'empty';

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

const STATE_LABELS: Record<RoomState, string> = {
  available: 'Available',
  full: 'Full',
  partial: 'Partial',
  empty: 'Empty',
};

function bedLabel(index: number) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[index] || `Bed ${index + 1}`;
}

export default function Page() {
  const [floors, setFloors] = useState<Floor[]>([]);
  const [activeFloor, setActiveFloor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ role: string; section: 'brothers' | 'sisters' } | null>(null);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [sectionView, setSectionView] = useState<'all' | 'brothers' | 'sisters'>('all');
  const [roomForm, setRoomForm] = useState({ name: '', capacity: '4' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/admin/accommodation/overview');
      setFloors(data);
      setActiveFloor((current) => current || data[0]?.id || null);
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

  const visibleFloors = useMemo(() => {
    if (user?.role !== 'super_admin' || sectionView === 'all') return floors;
    return floors.filter((entry) => entry.section_scope === sectionView);
  }, [floors, sectionView, user?.role]);

  const floor = visibleFloors.find((entry) => entry.id === activeFloor) || visibleFloors[0] || null;

  const totals = visibleFloors.reduce(
    (acc, current) => {
      current.rooms.forEach((room) => {
        acc.capacity += room.capacity;
        acc.occupied += room.occupied;
      });
      acc.unassigned += current.unassigned.length;
      return acc;
    },
    { capacity: 0, occupied: 0, unassigned: 0 }
  );

  const roomTotals = useMemo(() => ({
    full: floor?.rooms.filter((room) => room.state === 'full').length || 0,
    partial: floor?.rooms.filter((room) => room.state === 'partial').length || 0,
    available: floor?.rooms.filter((room) => room.state === 'available').length || 0,
    empty: floor?.rooms.filter((room) => room.state === 'empty').length || 0,
  }), [floor]);

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!floor) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/admin/accommodation/rooms', {
        method: 'POST',
        body: JSON.stringify({
          building_id: floor.id,
          name: roomForm.name,
          capacity: Number(roomForm.capacity),
        }),
      });
      setRoomForm({ name: '', capacity: '4' });
      setShowRoomModal(false);
      await load();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const brothersFloors = floors.filter((entry) => entry.section_scope === 'brothers');
  const sistersFloors = floors.filter((entry) => entry.section_scope === 'sisters');

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Floors &amp; Rooms</h1>
        <p>Fixed floor plan with room capacities for ground and first floor.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div><h3>{visibleFloors.length}</h3><p>Floors</p></div></div>
        <div className="stat-card"><div><h3>{totals.occupied}/{totals.capacity}</h3><p>Total Occupancy</p></div></div>
        <div className="stat-card"><div><h3>{totals.unassigned}</h3><p>Unassigned Students</p></div></div>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Floor Plan</h2>
            <p>{user?.role === 'super_admin' ? 'Cross-section room occupancy for brothers and sisters.' : 'Ground and first floor room occupancy view.'}</p>
          </div>
          <div className="event-actions">
            <button type="button" className="btn-outline" onClick={() => setShowRoomModal(true)}>
              Add Room
            </button>
            <Link href="/admin/accommodation/assign" className="btn-outline">
              Manage Assignments
            </Link>
          </div>
        </div>

        {user?.role === 'super_admin' ? (
          <div className="legend-row" style={{ padding: '0 1rem 1rem' }}>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('all'); setActiveFloor(null); }}>
              Both Sections
            </button>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'brothers' ? 'var(--green)' : 'white', color: sectionView === 'brothers' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('brothers'); setActiveFloor(null); }}>
              {BROTHERS_CENTER_NAME}
            </button>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'sisters' ? 'var(--green)' : 'white', color: sectionView === 'sisters' ? 'white' : 'var(--green)' }} onClick={() => { setSectionView('sisters'); setActiveFloor(null); }}>
              {SISTERS_CENTER_NAME}
            </button>
          </div>
        ) : null}

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
        {loading ? <div className="empty-state"><p>Loading accommodation...</p></div> : null}

        <div className="legend-row">
          <div className="legend-pill legend-available">Available {roomTotals.available}</div>
          <div className="legend-pill legend-full">Full {roomTotals.full}</div>
          <div className="legend-pill legend-partial">Partial {roomTotals.partial}</div>
          <div className="legend-pill legend-empty">Empty {roomTotals.empty}</div>
        </div>

        {user?.role === 'super_admin' ? (
          <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', padding: '0 1rem 1rem' }}>
            <div className="content-card">
              <div className="content-card-header"><h2>{BROTHERS_CENTER_NAME}</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <div><strong>{brothersFloors.length}</strong> floors</div>
                <div><strong>{brothersFloors.reduce((sum, b) => sum + b.rooms.reduce((roomSum, room) => roomSum + room.occupied, 0), 0)}</strong> occupied beds</div>
                <div><strong>{brothersFloors.reduce((sum, b) => sum + b.unassigned.length, 0)}</strong> unassigned students</div>
              </div>
            </div>
            <div className="content-card">
              <div className="content-card-header"><h2>{SISTERS_CENTER_NAME}</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <div><strong>{sistersFloors.length}</strong> floors</div>
                <div><strong>{sistersFloors.reduce((sum, b) => sum + b.rooms.reduce((roomSum, room) => roomSum + room.occupied, 0), 0)}</strong> occupied beds</div>
                <div><strong>{sistersFloors.reduce((sum, b) => sum + b.unassigned.length, 0)}</strong> unassigned students</div>
              </div>
            </div>
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
              onClick={() => setActiveFloor(entry.id)}
            >
              {entry.name} {user?.role === 'super_admin' ? `· ${entry.section_scope}` : ''}
            </button>
          ))}
        </div>

        {floor ? <div className="block-shell">
          <div className="block-title">
            {floor.name} {user?.role === 'super_admin' ? `· ${floor.section_scope}` : ''}
            <span style={{ float: 'right', textTransform: 'none', fontWeight: 600 }}>{floor.manager_name || 'No manager set'}</span>
          </div>

          <div className="room-grid">
            {floor.rooms.map((room) => (
              <div key={room.id} className={`room-card ${room.state}`}>
                <div className="room-card-header">{room.name}</div>
                <div className="room-card-body">
                  <div className="room-count">{room.occupied}/{room.capacity}</div>
                  <div className="room-state">{STATE_LABELS[room.state]}</div>
                  <div className="room-bed-list">
                    {Array.from({ length: room.capacity }).map((_, index) => {
                      const resident = room.residents[index];
                      return (
                        <div key={`${room.id}-${index}`} className={`room-bed-slot ${resident ? 'occupied' : 'free'}`}>
                          <span className="bed-label">{bedLabel(index)}</span>
                          {resident ? (
                            <Link href={`/admin/profiles/${resident.id}`} className="student-name-link">
                              {resident.full_name || resident.email}
                            </Link>
                          ) : <span className="table-muted">Available</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div> : null}

        {floor ? <div className="block-shell">
          <div className="block-title">Unassigned Students for {floor.name}</div>
          <div className="unassigned-grid">
            {floor.unassigned.map((student) => (
              <div key={student.id} className="unassigned-card">
                <div className="unassigned-avatar">{(student.full_name || student.email).slice(0, 2).toUpperCase()}</div>
                <Link href={`/admin/profiles/${student.id}`} className="unassigned-name student-name-link">{student.full_name || student.email}</Link>
                <div className="unassigned-meta">{student.institution || student.course || 'No profile details'}</div>
              </div>
            ))}
          </div>
        </div> : null}
      </section>

      {showRoomModal ? (
        <div className="page-modal-backdrop" onClick={() => setShowRoomModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(8, 18, 12, 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 160 }}>
          <div className="page-modal" onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 520px)', border: '1px solid #d7e6dc', borderRadius: '1rem', background: 'white', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.18)', overflow: 'hidden' }}>
            <div className="section-outline-header">
              <div>
                <h2>Add Room</h2>
                <p>{floor ? `Create a room inside ${floor.name}.` : 'Select a floor first.'}</p>
              </div>
            </div>
            <form onSubmit={createRoom} className="form-stack" style={{ padding: '1rem' }}>
              {!floor ? <div className="error-msg">Select a floor first, then add the room.</div> : null}
              <div className="field">
                <label>Room Name</label>
                <input value={roomForm.name} onChange={(e) => setRoomForm((current) => ({ ...current, name: e.target.value }))} placeholder="Room 7" disabled={!floor} />
              </div>
              <div className="field">
                <label>Capacity</label>
                <input value={roomForm.capacity} onChange={(e) => setRoomForm((current) => ({ ...current, capacity: e.target.value }))} disabled={!floor} />
              </div>
              <div className="event-actions">
                <button type="button" className="btn-outline" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={saving || !floor}>{saving ? 'Saving...' : 'Save Room'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
