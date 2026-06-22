'use client';
import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { PLATFORM_NAME } from '@/lib/centers';

export default function LoginPage() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(form) });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      const dest = data.user.role === 'student' ? '/student/dashboard' : '/admin/dashboard';
      window.location.href = dest;
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }, [form]);

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
          <h1>{PLATFORM_NAME}</h1>
          <p>HAYRAT CENTER</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
          <button type="button" className="btn-primary" disabled={loading} onClick={handleSubmit} style={{ marginTop: '0.5rem' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
