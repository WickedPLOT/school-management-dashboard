'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Building = {
  id: number;
  name: string;
  section_scope: 'brothers' | 'sisters';
  manager_name?: string;
  rooms: Array<{ id: number; name: string; capacity: number; occupied: number }>;
  unassigned: Array<{ id: number }>;
};

export default function Page() {
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/admin/accommodation/overview')
      .then(setBuildings)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => ([
    { key: 'brothers', label: 'Brothers', items: buildings.filter((b) => b.section_scope === 'brothers') },
    { key: 'sisters', label: 'Sisters', items: buildings.filter((b) => b.section_scope === 'sisters') },
  ]), [buildings]);

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Occupancy Overview</h1>
        <p>Cross-section occupancy view for brothers and sisters dormitories.</p>
      </div>

      {loading ? <div className="empty-state"><p>Loading occupancy...</p></div> : null}
      {error ? <div className="error-msg">{error}</div> : null}

      <div className="content-grid" style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {sections.map((section) => {
          const capacity = section.items.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + room.capacity, 0), 0);
          const occupied = section.items.reduce((sum, building) => sum + building.rooms.reduce((roomSum, room) => roomSum + room.occupied, 0), 0);
          const unassigned = section.items.reduce((sum, building) => sum + building.unassigned.length, 0);

          return (
            <section key={section.key} className="content-card">
              <div className="content-card-header">
                <h2>{section.label} Section</h2>
              </div>
              <div style={{ padding: '1rem', display: 'grid', gap: '0.75rem' }}>
                <div><strong>{section.items.length}</strong> buildings</div>
                <div><strong>{occupied}/{capacity}</strong> occupied beds</div>
                <div><strong>{unassigned}</strong> unassigned students</div>
                {section.items.map((building) => (
                  <div key={building.id} style={{ border: '1px solid var(--border)', borderRadius: '0.8rem', padding: '0.85rem' }}>
                    <strong>{building.name}</strong>
                    <div style={{ color: 'var(--muted)', marginTop: '0.35rem' }}>
                      {building.rooms.length} rooms • {building.manager_name || 'No manager set'}
                    </div>
                    <div style={{ color: 'var(--muted)', marginTop: '0.25rem' }}>
                      {building.rooms.reduce((sum, room) => sum + room.occupied, 0)}/{building.rooms.reduce((sum, room) => sum + room.capacity, 0)} occupied
                    </div>
                  </div>
                ))}
                {!section.items.length ? <p>No buildings added for this section yet.</p> : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
