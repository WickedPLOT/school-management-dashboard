'use client';
import Link from 'next/link';

export type StudentRow = {
  id: number; email: string; section: string; status: string; created_at: string;
  full_name?: string; gender?: string; phone?: string; institution?: string; course?: string;
};

type Props = {
  students: StudentRow[];
  loading: boolean;
  error: string;
  actions?: (s: StudentRow) => React.ReactNode;
  emptyMsg?: string;
};

export default function StudentTable({ students, loading, error, actions, emptyMsg }: Props) {
  if (loading) return <div className="empty-state"><p>Loading...</p></div>;
  if (error)   return <div style={{ padding: '1.5rem' }}><div className="error-msg">{error}</div></div>;
  if (!students.length) return (
    <div className="empty-state">
      <p>{emptyMsg || 'No students found.'}</p>
    </div>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: '#fafafa' }}>
            {['Name', 'Email', 'Section', 'Gender', 'Institution', 'Course', 'Joined', ...(actions ? ['Actions'] : [])].map(h => (
              <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, fontSize: '0.75rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid var(--border)' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#fafafa')}
              onMouseLeave={e => (e.currentTarget.style.background = 'white')}
            >
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>
                <Link href={`/admin/profiles/${s.id}`} style={{ color: 'var(--green)' }}>
                  {s.full_name || '—'}
                </Link>
              </td>
              <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)' }}>{s.email}</td>
              <td style={{ padding: '0.75rem 1rem' }}>
                <span className={`badge badge-${s.section}`}>{s.section}</span>
              </td>
              <td style={{ padding: '0.75rem 1rem', textTransform: 'capitalize' }}>{s.gender || '—'}</td>
              <td style={{ padding: '0.75rem 1rem' }}>{s.institution || '—'}</td>
              <td style={{ padding: '0.75rem 1rem' }}>{s.course || '—'}</td>
              <td style={{ padding: '0.75rem 1rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                {new Date(s.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </td>
              {actions && <td style={{ padding: '0.75rem 1rem' }}>{actions(s)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
