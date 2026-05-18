'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import StudentTable, { StudentRow } from '@/components/StudentTable';

export default function IncompleteProfilesPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/admin/profiles/incomplete')
      .then(setStudents)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
        <StudentTable students={students} loading={loading} error={error} emptyMsg="All profiles are complete." />
      </div>
    </div>
  );
}
