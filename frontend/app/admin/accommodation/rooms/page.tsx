'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

const STATE_LABELS: Record<RoomState, string> = {
  available: 'Available',
  full: 'Full',
  partial: 'Partial',
  empty: 'Empty',
};

export default function Page() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [activeBuilding, setActiveBuilding] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<{ role: string; section: 'brothers' | 'sisters' } | null>(null);
  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [sectionView, setSectionView] = useState<'all' | 'brothers' | 'sisters'>('all');
  const [buildingForm, setBuildingForm] = useState({ name: '', section_scope: 'brothers', manager_name: '' });
  const [roomForm, setRoomForm] = useState({ name: '', capacity: '4' });

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/admin/accommodation/overview');
      setBuildings(data);
      setActiveBuilding((current) => current || data[0]?.id || null);
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
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        if (parsed.role !== 'super_admin' && (parsed.section === 'brothers' || parsed.section === 'sisters')) {
          setBuildingForm((current) => ({ ...current, section_scope: parsed.section }));
        }
      }
    } catch {}
  }, []);

  const visibleBuildings = useMemo(() => {
    if (user?.role !== 'super_admin' || sectionView === 'all') return buildings;
    return buildings.filter((entry) => entry.section_scope === sectionView);
  }, [buildings, sectionView, user?.role]);

  const building = visibleBuildings.find((entry) => entry.id === activeBuilding) || visibleBuildings[0] || null;

  const totals = visibleBuildings.reduce(
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
    full: building?.rooms.filter((room) => room.state === 'full').length || 0,
    partial: building?.rooms.filter((room) => room.state === 'partial').length || 0,
    available: building?.rooms.filter((room) => room.state === 'available').length || 0,
    empty: building?.rooms.filter((room) => room.state === 'empty').length || 0,
  }), [building]);

  async function createBuilding(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await apiFetch('/admin/accommodation/buildings', {
        method: 'POST',
        body: JSON.stringify({
          ...buildingForm,
          section_scope: user?.role === 'super_admin' ? buildingForm.section_scope : (user?.section || 'brothers'),
        }),
      });
      setBuildingForm({
        name: '',
        section_scope: user?.role === 'super_admin' ? (building?.section_scope || 'brothers') : (user?.section || 'brothers'),
        manager_name: '',
      });
      setShowBuildingModal(false);
      await load();
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function createRoom(e: React.FormEvent) {
    e.preventDefault();
    if (!building) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch('/admin/accommodation/rooms', {
        method: 'POST',
        body: JSON.stringify({
          building_id: building.id,
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

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Dormitories &amp; Rooms</h1>
        <p>Dormitory overview with room blocks and occupancy status.</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div>
            <h3>{buildings.length}</h3>
            <p>Buildings</p>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3>{totals.occupied}/{totals.capacity}</h3>
            <p>Total Occupancy</p>
          </div>
        </div>
        <div className="stat-card">
          <div>
            <h3>{totals.unassigned}</h3>
            <p>Unassigned Students</p>
          </div>
        </div>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Dormitory Floor Plan</h2>
            <p>{user?.role === 'super_admin' ? 'Cross-section occupancy view for brothers and sisters.' : 'Visual occupancy overview. Add dorms and rooms from pop-up actions.'}</p>
          </div>
          <div className="event-actions">
            <button type="button" className="btn-outline" onClick={() => setShowBuildingModal(true)}>
              Add New Dorm
            </button>
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
            <button
              type="button"
              className="btn-outline"
              style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }}
              onClick={() => {
                setSectionView('all');
                setActiveBuilding(null);
              }}
            >
              Both Sections
            </button>
            <button
              type="button"
              className="btn-outline"
              style={{ background: sectionView === 'brothers' ? 'var(--green)' : 'white', color: sectionView === 'brothers' ? 'white' : 'var(--green)' }}
              onClick={() => {
                setSectionView('brothers');
                setActiveBuilding(null);
              }}
            >
              Brothers
            </button>
            <button
              type="button"
              className="btn-outline"
              style={{ background: sectionView === 'sisters' ? 'var(--green)' : 'white', color: sectionView === 'sisters' ? 'white' : 'var(--green)' }}
              onClick={() => {
                setSectionView('sisters');
                setActiveBuilding(null);
              }}
            >
              Sisters
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
              onClick={() => setActiveBuilding(entry.id)}
            >
              {entry.name} {user?.role === 'super_admin' ? `· ${entry.section_scope}` : ''}
            </button>
          ))}
        </div>

        {user?.role === 'super_admin' ? (
          <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', padding: '0 1rem 1rem' }}>
            <div className="content-card">
              <div className="content-card-header"><h2>Brothers Occupancy</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <div><strong>{buildings.filter((b) => b.section_scope === 'brothers').length}</strong> buildings</div>
                <div><strong>{buildings.filter((b) => b.section_scope === 'brothers').reduce((sum, b) => sum + b.rooms.reduce((roomSum, room) => roomSum + room.occupied, 0), 0)}</strong> occupied beds</div>
                <div><strong>{buildings.filter((b) => b.section_scope === 'brothers').reduce((sum, b) => sum + b.unassigned.length, 0)}</strong> unassigned students</div>
              </div>
            </div>
            <div className="content-card">
              <div className="content-card-header"><h2>Sisters Occupancy</h2></div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.55rem' }}>
                <div><strong>{buildings.filter((b) => b.section_scope === 'sisters').length}</strong> buildings</div>
                <div><strong>{buildings.filter((b) => b.section_scope === 'sisters').reduce((sum, b) => sum + b.rooms.reduce((roomSum, room) => roomSum + room.occupied, 0), 0)}</strong> occupied beds</div>
                <div><strong>{buildings.filter((b) => b.section_scope === 'sisters').reduce((sum, b) => sum + b.unassigned.length, 0)}</strong> unassigned students</div>
              </div>
            </div>
          </div>
        ) : null}

        {building ? <div className="block-shell">
          <div className="block-title">
            {building.name} {user?.role === 'super_admin' ? `· ${building.section_scope}` : ''}
            <span style={{ float: 'right', textTransform: 'none', fontWeight: 600 }}>{building.manager_name || 'No manager set'}</span>
          </div>

          <div className="room-grid">
            {building.rooms.map((room) => (
              <div key={room.id} className={`room-card ${room.state}`}>
                <div className="room-card-header">{room.name}</div>
                <div className="room-card-body">
                  <div className="room-count">
                    {room.occupied}/{room.capacity}
                  </div>
                  <div className="room-state">{STATE_LABELS[room.state]}</div>
                  <div className="room-residents">
                    {room.residents.length === 0 ? <span>Empty</span> : room.residents.map((resident) => (
                      <span key={resident.id}>
                        {resident.full_name || resident.email}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div> : null}

        {building ? <div className="block-shell">
          <div className="block-title">Unassigned Students for {building.name}</div>
          <div className="unassigned-grid">
            {building.unassigned.map((student) => (
              <div key={student.id} className="unassigned-card">
                <div className="unassigned-avatar">{(student.full_name || student.email).slice(0, 2).toUpperCase()}</div>
                <div className="unassigned-name">{student.full_name || student.email}</div>
                <div className="unassigned-meta">{student.institution || student.course || 'No profile details'}</div>
              </div>
            ))}
          </div>
        </div> : null}
      </section>

      {showBuildingModal ? (
        <div
          className="page-modal-backdrop"
          onClick={() => setShowBuildingModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8, 18, 12, 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 160 }}
        >
          <div
            className="page-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100%, 520px)', border: '1px solid #d7e6dc', borderRadius: '1rem', background: 'white', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.18)', overflow: 'hidden' }}
          >
            <div className="section-outline-header">
              <div>
                <h2>Add New Dorm</h2>
                <p>Create a new dormitory/building without leaving the floor plan.</p>
              </div>
            </div>
            <form onSubmit={createBuilding} className="form-stack" style={{ padding: '1rem' }}>
              <div className="field">
                <label>Dorm Name</label>
                <input value={buildingForm.name} onChange={(e) => setBuildingForm((current) => ({ ...current, name: e.target.value }))} placeholder="Brothers Block A" />
              </div>
              <div className="field">
                <label>Section</label>
                {user?.role === 'super_admin' ? (
                  <select value={buildingForm.section_scope} onChange={(e) => setBuildingForm((current) => ({ ...current, section_scope: e.target.value }))}>
                    <option value="brothers">Brothers</option>
                    <option value="sisters">Sisters</option>
                  </select>
                ) : (
                  <input value={user?.section === 'sisters' ? 'Sisters' : 'Brothers'} disabled />
                )}
              </div>
              <div className="field">
                <label>Manager</label>
                <input value={buildingForm.manager_name} onChange={(e) => setBuildingForm((current) => ({ ...current, manager_name: e.target.value }))} placeholder="Dorm master or supervisor" />
              </div>
              <div className="event-actions">
                <button type="button" className="btn-outline" onClick={() => setShowBuildingModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={saving}>{saving ? 'Saving...' : 'Save Dorm'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showRoomModal ? (
        <div
          className="page-modal-backdrop"
          onClick={() => setShowRoomModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(8, 18, 12, 0.42)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', zIndex: 160 }}
        >
          <div
            className="page-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(100%, 520px)', border: '1px solid #d7e6dc', borderRadius: '1rem', background: 'white', boxShadow: '0 24px 70px rgba(0, 0, 0, 0.18)', overflow: 'hidden' }}
          >
            <div className="section-outline-header">
              <div>
                <h2>Add Room</h2>
                <p>{building ? `Create a room inside ${building.name}.` : 'Select a dorm first.'}</p>
              </div>
            </div>
            <form onSubmit={createRoom} className="form-stack" style={{ padding: '1rem' }}>
              {!building ? (
                <div className="error-msg">
                  Add a dorm first, then come back here to create rooms inside it.
                </div>
              ) : null}
              <div className="field">
                <label>Room Name</label>
                <input value={roomForm.name} onChange={(e) => setRoomForm((current) => ({ ...current, name: e.target.value }))} placeholder="A-101" disabled={!building} />
              </div>
              <div className="field">
                <label>Capacity</label>
                <input value={roomForm.capacity} onChange={(e) => setRoomForm((current) => ({ ...current, capacity: e.target.value }))} disabled={!building} />
              </div>
              <div className="event-actions">
                <button type="button" className="btn-outline" onClick={() => setShowRoomModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ width: 'auto' }} disabled={saving || !building}>{saving ? 'Saving...' : 'Save Room'}</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
