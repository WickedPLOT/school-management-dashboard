'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';

export default function SearchProfilesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  async function search(query: string) {
    setLoading(true); setError('');
    try {
      const data = await apiFetch(`/admin/profiles?q=${encodeURIComponent(query)}`);
      setStudents(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  // Load all on mount
  useEffect(() => { search(''); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>View / Search Profiles</h1>
        <p>Search approved student profiles by name, email, or institution</p>
      </div>
      <div className="content-card">
        <div className="content-card-header">
          <h2>Student Profiles</h2>
          <form onSubmit={e => { e.preventDefault(); search(q); }} style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              placeholder="Search..."
              value={q}
              onChange={e => { setQ(e.target.value); if (!e.target.value) search(''); }}
              style={{ border: '1.5px solid var(--border)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', outline: 'none', width: 240 }}
            />
            <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.375rem 0.875rem', fontSize: '0.8rem' }}>
              Search
            </button>
          </form>
        </div>
        <StudentTable students={students} loading={loading} error={error} emptyMsg="No profiles found." />
      </div>
    </div>
  );
}
