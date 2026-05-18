'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';

export default function AllStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch('/admin/students')
      .then(setStudents)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(s =>
    !search || [s.full_name, s.email, s.institution, s.course].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div className="page-header">
        <h1>All Students</h1>
        <p>All approved student accounts</p>
      </div>
      <div className="content-card">
        <div className="content-card-header">
          <h2>Students</h2>
          <input
            placeholder="Search by name, email, institution..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: '1.5px solid var(--border)', borderRadius: '0.5rem', padding: '0.375rem 0.75rem', fontSize: '0.8rem', outline: 'none', width: 260 }}
          />
        </div>
        <StudentTable students={filtered} loading={loading} error={error} emptyMsg="No approved students yet." />
      </div>
    </div>
  );
}
