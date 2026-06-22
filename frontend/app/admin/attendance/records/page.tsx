'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type Row = {
  id: number;
  email: string;
  section: string;
  full_name?: string;
  institution?: string;
  course?: string;
  marked_events: string;
  present_count: string;
  late_count: string;
  absent_count: string;
  excused_count: string;
  attendance_rate: string;
};

export default function Page() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [user, setUser] = useState<{ role: string } | null>(null);
  const [sectionView, setSectionView] = useState<'all' | 'brothers' | 'sisters'>('all');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('user');
      if (stored) setUser(JSON.parse(stored));
    } catch {}
    apiFetch('/admin/attendance/overview')
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const filteredRows = useMemo(() => {
    if (user?.role !== 'super_admin' || sectionView === 'all') return rows;
    return rows.filter((row) => row.section === sectionView);
  }, [rows, sectionView, user?.role]);

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Attendance Summary</h1>
        <p>Per-student event attendance score and participation history</p>
      </div>

      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Student Attendance Rates</h2>
            <p>Attendance score is based on present, late, absent, and excused event records</p>
          </div>
        </div>

        {user?.role === 'super_admin' ? (
          <div className="legend-row" style={{ padding: '0 1rem 1rem' }}>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'all' ? 'var(--green)' : 'white', color: sectionView === 'all' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('all')}>
              Both Sections
            </button>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'brothers' ? 'var(--green)' : 'white', color: sectionView === 'brothers' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('brothers')}>
              {BROTHERS_CENTER_NAME}
            </button>
            <button type="button" className="btn-outline" style={{ background: sectionView === 'sisters' ? 'var(--green)' : 'white', color: sectionView === 'sisters' ? 'white' : 'var(--green)' }} onClick={() => setSectionView('sisters')}>
              {SISTERS_CENTER_NAME}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="empty-state"><p>Loading summary...</p></div>
        ) : error ? (
          <div style={{ padding: '1rem' }}><div className="error-msg">{error}</div></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Institution</th>
                  <th>Events</th>
                  <th>Present</th>
                  <th>Late</th>
                  <th>Absent</th>
                  <th>Excused</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.full_name || row.email}</strong>
                      <div className="table-muted">{row.email}</div>
                      {user?.role === 'super_admin' ? <div className="table-muted" style={{ textTransform: 'capitalize' }}>{row.section}</div> : null}
                    </td>
                    <td>{row.institution || '—'}</td>
                    <td>{row.marked_events}</td>
                    <td>{row.present_count}</td>
                    <td>{row.late_count}</td>
                    <td>{row.absent_count}</td>
                    <td>{row.excused_count}</td>
                    <td>
                      <span className={`badge ${Number(row.attendance_rate) < 60 ? 'badge-failed' : 'badge-sent'}`}>
                        {row.attendance_rate}%
                      </span>
                    </td>
                  </tr>
                ))}
                {!loading && !error && filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-muted">No attendance rows for this section view.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
