'use client';
import { useState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { mockLogin } from '@/lib/mockData';

type PublicSettings = {
  centre_name?: string;
  platform_label?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<PublicSettings>({});

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/settings/public`)
      .then((res) => res.json())
      .then(setBranding)
      .catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let data;
      try {
        data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      } catch {
        // fallback to mock creds for UI testing
        const mock = mockLogin(form.email, form.password);
        if (!mock) throw new Error('Invalid credentials');
        data = mock;
      }
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.role === 'student') router.push('/student/profile');
      else router.push('/admin/registrations');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M16 4C16 4 8 8 8 16C8 20.4 11.6 24 16 24C20.4 24 24 20.4 24 16C24 8 16 4 16 4Z" fill="white" opacity="0.9"/>
              <path d="M16 10C16 10 12 12 12 16C12 18.2 13.8 20 16 20C18.2 20 20 18.2 20 16C20 12 16 10 16 10Z" fill="#c9a84c"/>
            </svg>
          </div>
          <h1>{branding.centre_name || 'Hayrat Centre'}</h1>
          <p>{branding.platform_label || 'Student Resident Management System'}</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="field">
            <label>Email Address</label>
            <input type="email" required placeholder="you@example.com"
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required placeholder="Your password"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
          </div>
          {error && <div className="error-msg">{error}</div>}
          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.8rem', marginTop: '1.25rem', color: '#6b7280' }}>
          New student?{' '}
          <a href="/register" style={{ color: 'var(--green)', fontWeight: 600, textDecoration: 'none' }}>Register here</a>
        </p>

        {/* Dev hint */}
        <div style={{ marginTop: '1.5rem', padding: '0.75rem', background: '#f9fafb', borderRadius: '0.5rem', fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.6 }}>
          <strong style={{ color: '#6b7280' }}>Test accounts:</strong><br/>
          brothers.admin@hayrat.com / admin123<br/>
          sisters.admin@hayrat.com / admin123<br/>
          student@hayrat.com / student123
        </div>
      </div>
    </div>
  );
}
