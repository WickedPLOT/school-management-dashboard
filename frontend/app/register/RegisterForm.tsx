'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const PERSONAL_FIELDS = [
  { name: 'full_name',   label: 'Full Name',          type: 'text',   required: true,  span: 2 },
  { name: 'email',       label: 'Email Address',      type: 'email',  required: true },
  { name: 'phone',       label: 'Phone Number',       type: 'text',   required: true },
  { name: 'gender',      label: 'Gender',             type: 'select', required: true,  options: ['male', 'female'] },
  { name: 'home_county', label: 'Home County',        type: 'text',   required: false },
] as const;

const ACADEMIC_FIELDS = [
  { name: 'institution',   label: 'Institution',          type: 'text',   required: true,  span: 2 },
  { name: 'course',        label: 'Course / Programme',   type: 'text',   required: true },
  { name: 'year_of_study', label: 'Year of Study',        type: 'number', required: false },
  { name: 'quran_level',   label: "Qur'an Level",         type: 'text',   required: false, span: 2 },
] as const;

const PASSWORD_FIELDS = [
  { name: 'password',         label: 'Password',         type: 'password', required: true },
  { name: 'confirm_password', label: 'Confirm Password', type: 'password', required: true },
] as const;

type AnyField = typeof PERSONAL_FIELDS[number] | typeof ACADEMIC_FIELDS[number] | typeof PASSWORD_FIELDS[number];

function FieldInput({ f, form, setForm }: { f: AnyField; form: Record<string, string>; setForm: (v: Record<string, string>) => void }) {
  const style = 'span' in f && f.span === 2 ? { gridColumn: '1 / -1' } : {};
  return (
    <div className="field" style={style}>
      <label>
        {f.label}
        {f.required && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
      </label>
      {f.type === 'select' ? (
        <select required={f.required} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}>
          <option value="">Select...</option>
          {'options' in f && f.options.map((o: string) => (
            <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
          ))}
        </select>
      ) : (
        <input
          type={f.type}
          required={f.required}
          placeholder={f.label}
          minLength={f.type === 'password' ? 6 : undefined}
          value={form[f.name] || ''}
          onChange={e => setForm({ ...form, [f.name]: e.target.value })}
        />
      )}
    </div>
  );
}

const Logo = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
    <path d="M16 4C16 4 8 8 8 16C8 20.4 11.6 24 16 24C20.4 24 24 20.4 24 16C24 8 16 4 16 4Z" fill="white" opacity="0.9"/>
    <path d="M16 10C16 10 12 12 12 16C12 18.2 13.8 20 16 20C18.2 20 20 18.2 20 16C20 12 16 10 16 10Z" fill="#c9a84c"/>
  </svg>
);

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [branding, setBranding] = useState<{ centre_name?: string; platform_label?: string; approval_required?: boolean }>({});

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/settings/public`)
      .then((res) => res.json())
      .then(setBranding)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setError('No invite token found. Please use the registration link sent by your admin.');
      setValidating(false);
      return;
    }
    apiFetch(`/auth/validate-invite?token=${token}`)
      .then(() => { setTokenValid(true); setValidating(false); })
      .catch(() => { setError('This invite link is invalid or has expired.'); setValidating(false); });
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if ((form.password || '').length < 6) { setError('Password must be at least 6 characters'); return; }
    if (form.password !== form.confirm_password) { setError('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { confirm_password, ...payload } = form;
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ ...payload, invite_token: token }) });
      router.push('/pending');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (validating) {
    return (
      <div className="auth-wrap">
        <div className="auth-card" style={{ textAlign: 'center', color: 'var(--muted)' }}>Validating invite link...</div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <div className="auth-logo"><div className="logo-icon"><Logo /></div><h1>{branding.centre_name || 'Hayrat Centre'}</h1></div>
          <div className="error-msg">{error}</div>
          <a href="/login" style={{ display: 'block', textAlign: 'center', marginTop: '1.25rem', color: 'var(--green)', fontWeight: 600, fontSize: '0.875rem' }}>Back to Login</a>
        </div>
      </div>
    );
  }

  const sectionLabel = (label: string) => (
    <p style={{ gridColumn: '1 / -1', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '-0.25rem' }}>
      {label}
    </p>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-card" style={{ maxWidth: 620 }}>
        <div className="auth-logo">
          <div className="logo-icon"><Logo /></div>
          <h1>{branding.centre_name || 'Hayrat Centre'}</h1>
          <p>{branding.platform_label || 'Student Registration'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {sectionLabel('Personal Information')}
            {PERSONAL_FIELDS.map(f => <FieldInput key={f.name} f={f} form={form} setForm={setForm} />)}

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
            {sectionLabel('Academic Information')}
            {ACADEMIC_FIELDS.map(f => <FieldInput key={f.name} f={f} form={form} setForm={setForm} />)}

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
            {sectionLabel('Set Your Password')}
            {PASSWORD_FIELDS.map(f => <FieldInput key={f.name} f={f} form={form} setForm={setForm} />)}
          </div>

          {error && <div className="error-msg" style={{ marginTop: '1rem' }}>{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '1.5rem' }}>
            {loading ? 'Submitting...' : 'Submit Registration'}
          </button>
        </form>

        <p style={{ marginTop: '0.85rem', fontSize: '0.74rem', color: 'var(--muted)', textAlign: 'center' }}>
          {branding.approval_required === false ? 'Registrations can be approved automatically based on current settings.' : 'Registrations currently require admin approval.'}
        </p>

        <p className="auth-footer">Already have an account? <a href="/login">Sign in</a></p>
      </div>
    </div>
  );
}
