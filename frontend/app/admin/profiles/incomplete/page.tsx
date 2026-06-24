'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';

export default function IncompleteProfilesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [prompting, setPrompting] = useState<number | null>(null);
  const [toast, setToast] = useState('');

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
      setToast('Prompt notification sent successfully');
      setTimeout(() => setToast(''), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setPrompting(null); }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Incomplete Profiles</h1>
        <p>Students missing required profile information</p>
      </div>
      {toast && (
        <div style={{ background: '#065f46', color: 'white', padding: '0.75rem 1.25rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>
          ✓ {toast}
        </div>
      )}
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
              {prompting === s.id ? 'Sending...' : '📢 Prompt'}
            </button>
          )}
        />
      </div>
    </div>
  );
}
