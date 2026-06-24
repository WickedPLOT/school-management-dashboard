'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';

export default function IncompleteProfilesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prompting, setPrompting] = useState<number | null>(null);

  useEffect(() => {
    apiFetch('/admin/profiles/incomplete')
      .then(setStudents)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function prompt(id: number) {
    setPrompting(id);
    try {
      await apiFetch(`/admin/profiles/${id}/prompt`, { method: 'POST' });
      alert('Prompt notification sent');
    } catch (e: any) { alert(e.message); }
    finally { setPrompting(null); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Incomplete Profiles</h1>
        <p>Students missing required profile information</p>
      </div>
      <div className="content-card">
        <div className="content-card-header">
          <h2>Incomplete</h2>
          <span>{!loading && `${students.length} students`}</span>
        </div>
        <StudentTable
          students={students}
          loading={loading}
          error={error}
          emptyMsg="All profiles are complete."
          actions={(s) => (
            <button
              className="btn-outline"
              style={{ width: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.75rem' }}
              onClick={() => prompt(s.id)}
              disabled={prompting === s.id}
            >
              {prompting === s.id ? 'Sending...' : 'Prompt'}
            </button>
          )}
        />
      </div>
    </div>
  );
}
