'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';
import ConfirmModal from '@/components/ConfirmModal';

export default function AllStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<StudentRow | null>(null);

  async function load(q = '') {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch(`/admin/profiles${q ? `?q=${encodeURIComponent(q)}` : ''}`);
      setStudents(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    load(search);
  }

  async function handleDelete() {
    if (!confirmTarget) return;
    setDeleting(confirmTarget.id);
    setConfirmTarget(null);
    try {
      await apiFetch(`/admin/students/${confirmTarget.id}`, { method: 'DELETE' });
      setStudents(s => s.filter(x => x.id !== confirmTarget.id));
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(null); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>All Students</h1>
        <p>All approved student accounts</p>
      </div>
      <div className="content-card">
        <div className="content-card-header">
          <h2>Students</h2>
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="Search by name, email, institution..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: '1.5px solid var(--border)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', outline: 'none', width: 260 }}
            />
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.375rem 0.9rem' }}>Search</button>
          </form>
        </div>
        <StudentTable
          students={students}
          loading={loading}
          error={error}
          emptyMsg="No students found."
          actions={(s) => (
            <button
              style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.75rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}
              onClick={() => setConfirmTarget(s)}
              disabled={deleting === s.id}
            >
              {deleting === s.id ? 'Deleting...' : 'Delete'}
            </button>
          )}
        />
      </div>
      <ConfirmModal
        open={!!confirmTarget}
        title="Delete Student"
        message={`Are you sure you want to permanently delete ${confirmTarget?.full_name || confirmTarget?.email || 'this student'}? This action cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmTarget(null)}
      />
    </div>
  );
}
