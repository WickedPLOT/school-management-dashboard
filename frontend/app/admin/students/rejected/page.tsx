'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';

export default function RejectedStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    apiFetch('/admin/students/rejected')
      .then(setStudents)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }

  async function restore(id: number) {
    try {
      await apiFetch(`/admin/approve/${id}`, { method: 'PATCH' });
      setStudents(s => s.filter(x => x.id !== id));
    } catch (e: any) { setError(e.message); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Rejected Accounts</h1>
        <p>Students whose registrations were rejected</p>
      </div>
      <div className="content-card">
        <div className="content-card-header">
          <h2>Rejected</h2>
          <span>{students.length} accounts</span>
        </div>
        <StudentTable
          students={students} loading={loading} error={error}
          emptyMsg="No rejected accounts."
          actions={s => (
            <button className="btn-approve" onClick={() => restore(s.id)}>Restore</button>
          )}
        />
      </div>
    </div>
  );
}
