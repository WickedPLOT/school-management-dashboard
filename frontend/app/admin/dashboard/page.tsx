'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Icons } from '@/lib/icons';
import Link from 'next/link';

type Stats = { pending: number; approved: number; rejected: number; incomplete: number };

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/admin/dashboard')
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const cards = [
    { label: 'Pending Approvals',    value: stats?.pending,    icon: Icons.students,  color: '#fef3c7', href: '/admin/students/pending' },
    { label: 'Approved Students',    value: stats?.approved,   icon: Icons.students,  color: '#d1fae5', href: '/admin/students/all' },
    { label: 'Rejected Accounts',    value: stats?.rejected,   icon: Icons.students,  color: '#fee2e2', href: '/admin/students/rejected' },
    { label: 'Incomplete Profiles',  value: stats?.incomplete, icon: Icons.profile,   color: '#fef3c7', href: '/admin/profiles/incomplete' },
  ];

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of student accounts and system activity</p>
      </div>

      <div className="stats-grid">
        {cards.map(c => (
          <Link key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'transform 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div className="stat-icon" style={{ background: c.color }}>{c.icon}</div>
              <div>
                <h3>{loading ? '—' : c.value}</h3>
                <p>{c.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="content-card">
        <div className="content-card-header">
          <h2>Quick Actions</h2>
        </div>
        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <Link href="/admin/registrations" className="btn-primary" style={{ width: 'auto', padding: '0.625rem 1.25rem', textAlign: 'center' }}>
            Generate Registration Link
          </Link>
          <Link href="/admin/profiles" className="btn-primary" style={{ width: 'auto', padding: '0.625rem 1.25rem', textAlign: 'center', background: 'var(--green-light)', color: 'var(--green)' }}>
            Search Student Profiles
          </Link>
        </div>
      </div>
    </div>
  );
}
