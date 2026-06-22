'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';
import { PLATFORM_NAME } from '@/lib/centers';

const PERSONAL_FIELDS = [
  { name: 'full_name',   label: 'Full Name',          type: 'text',   required: true,  span: 2 },
  { name: 'email',       label: 'Email Address',      type: 'email',  required: true },
  { name: 'phone',       label: 'Phone Number',       type: 'text',   required: true },
  { name: 'gender',      label: 'Gender',             type: 'select', required: true,  options: ['male', 'female'] },
  { name: 'nationality', label: 'Nationality',        type: 'text',   required: true },
  { name: 'country',     label: 'Country',            type: 'text',   required: true },
  { name: 'county',      label: 'County',             type: 'text',   required: true },
  { name: 'sub_county',  label: 'Sub-County',         type: 'text',   required: false },
  { name: 'home_county', label: 'Home County / Area', type: 'text',   required: false },
] as const;


const CONTACT_FIELDS = [
  { name: 'parent_name', label: 'Parent / Guardian Name', type: 'text', required: false },
  { name: 'parent_phone', label: 'Parent / Guardian Phone', type: 'text', required: false },
  { name: 'parent_email', label: 'Parent / Guardian Email', type: 'email', required: false },
  { name: 'alt_student_phone', label: 'Alternative Student Phone', type: 'text', required: false },
  { name: 'alt_parent_phone', label: 'Alternative Parent Phone', type: 'text', required: false },
  { name: 'emergency_contact_1_name', label: 'Emergency Contact 1 Name', type: 'text', required: false },
  { name: 'emergency_contact_1_phone', label: 'Emergency Contact 1 Phone', type: 'text', required: false },
  { name: 'emergency_contact_1_relation', label: 'Emergency Contact 1 Relation', type: 'text', required: false },
  { name: 'emergency_contact_2_name', label: 'Emergency Contact 2 Name', type: 'text', required: false },
  { name: 'emergency_contact_2_phone', label: 'Emergency Contact 2 Phone', type: 'text', required: false },
  { name: 'emergency_contact_2_relation', label: 'Emergency Contact 2 Relation', type: 'text', required: false },
] as const;

const ACADEMIC_FIELDS = [
  { name: 'institution',   label: 'Institution',                  type: 'text',   required: true,  span: 2 },
  { name: 'course',        label: 'Course / Programme',           type: 'text',   required: true },
  { name: 'year_of_study', label: 'Year of Study',                type: 'number', required: false },
  { name: 'entry_date',    label: 'Date You Joined the Center',   type: 'date',   required: false },
  { name: 'quran_level',   label: "Qur'an Level",                 type: 'text',   required: false, span: 2 },
] as const;

const DOCUMENT_FIELDS = [
  { name: 'passport_photo_data', label: 'Passport Photo', type: 'file', required: false },
] as const;

const STUDENT_DOCUMENTS = [
  { key: 'passport_document', label: 'Passport Document' },
  { key: 'id_front', label: 'ID Front' },
  { key: 'id_back', label: 'ID Back' },
] as const;

const PASSWORD_FIELDS = [
  { name: 'password',         label: 'Password',         type: 'password', required: true },
  { name: 'confirm_password', label: 'Confirm Password', type: 'password', required: true },
] as const;

type AnyField = typeof PERSONAL_FIELDS[number] | typeof CONTACT_FIELDS[number] | typeof ACADEMIC_FIELDS[number] | typeof PASSWORD_FIELDS[number];


function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read selected image'));
    reader.readAsDataURL(file);
  });
}

function PassportPhotoInput({ form, setForm, setError }: { form: Record<string, string>; setForm: (v: Record<string, string>) => void; setError: (v: string) => void }) {
  async function onFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Passport photo must be an image file'); return; }
    if (file.size > 1024 * 1024 * 2) { setError('Passport photo must be below 2MB'); return; }
    setError('');
    const dataUrl = await readFileAsDataUrl(file);
    setForm({ ...form, passport_photo_data: dataUrl });
  }

  return (
    <div className="field" style={{ gridColumn: '1 / -1' }}>
      <label>Passport Photo <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span></label>
      <input type="file" accept="image/*" onChange={onFileChange} />
      {form.passport_photo_data ? (
        <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <img src={form.passport_photo_data} alt="Passport preview" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--border)' }} />
          <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => setForm({ ...form, passport_photo_data: '' })}>Remove Photo</button>
        </div>
      ) : <p className="table-muted" style={{ marginTop: '0.4rem' }}>Upload a clear passport-style image. Maximum 2MB.</p>}
    </div>
  );
}


function StudentDocumentUploads({ form, setForm, setError }: { form: Record<string, string>; setForm: (v: Record<string, string>) => void; setError: (v: string) => void }) {
  async function onFileChange(key: string, event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const allowed = file.type.startsWith('image/') || file.type === 'application/pdf';
    if (!allowed) { setError('Documents must be images or PDF files'); return; }
    if (file.size > 1024 * 1024 * 5) { setError('Each document must be below 5MB'); return; }
    setError('');
    const dataUrl = await readFileAsDataUrl(file);
    setForm({ ...form, [`${key}_data`]: dataUrl, [`${key}_name`]: file.name, [`${key}_mime`]: file.type });
  }

  return (
    <div className="document-upload-grid" style={{ gridColumn: '1 / -1' }}>
      {STUDENT_DOCUMENTS.map((doc) => (
        <div key={doc.key} className="field document-upload-card">
          <label>{doc.label}</label>
          <input type="file" accept="image/*,.pdf,application/pdf" onChange={(event) => onFileChange(doc.key, event)} />
          {form[`${doc.key}_data`] ? (
            <div className="document-upload-preview">
              <span>{form[`${doc.key}_name`] || 'Uploaded document'}</span>
              <button type="button" className="btn-outline" style={{ width: 'auto' }} onClick={() => {
                const next = { ...form };
                delete next[`${doc.key}_data`]; delete next[`${doc.key}_name`]; delete next[`${doc.key}_mime`];
                setForm(next);
              }}>Remove</button>
            </div>
          ) : <p className="table-muted">Image or PDF, max 5MB.</p>}
        </div>
      ))}
    </div>
  );
}

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
      ) : f.type === 'password' ? (
        <PasswordInput
          required={f.required}
          placeholder={f.label}
          minLength={6}
          value={form[f.name] || ''}
          onChange={e => setForm({ ...form, [f.name]: e.target.value })}
        />
      ) : (
        <input
          type={f.type}
          required={f.required}
          placeholder={f.label}
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
  const [validating, setValidating] = useState(!!token);
  const [tokenValid, setTokenValid] = useState(!token);
  const [branding, setBranding] = useState<{ centre_name?: string; platform_label?: string; approval_required?: boolean }>({});

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/settings/public`)
      .then((res) => res.json())
      .then(setBranding)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!token) {
      setTokenValid(true);
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
    if (!form.passport_photo_data) { setError('Passport photo is required'); return; }
    const hasPassport = !!form.passport_document_data;
    const hasIdFront = !!form.id_front_data;
    const hasIdBack = !!form.id_back_data;
    if (hasIdFront !== hasIdBack) {
      setError('Both ID Front and ID Back must be uploaded together');
      return;
    }
    if (!hasPassport && !hasIdFront) {
      setError('At least one document is required — upload your Passport or both ID sides');
      return;
    }
    setLoading(true);
    try {
      const { confirm_password, ...payload } = form;
      await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ ...payload, invite_token: token || undefined }) });
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
          <div className="auth-logo"><div className="logo-icon"><Logo /></div><h1>{PLATFORM_NAME}</h1></div>
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
          <h1>{PLATFORM_NAME}</h1>
          <p>{branding.platform_label || 'Student Registration'}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            {sectionLabel('Personal Information')}
            {PERSONAL_FIELDS.map(f => <FieldInput key={f.name} f={f} form={form} setForm={setForm} />)}
            <PassportPhotoInput form={form} setForm={setForm} setError={setError} />

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
            {sectionLabel('Student Documents')}
            <p style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: '#dc2626', margin: '-0.25rem 0 0.25rem' }}>Passport Document or ID (both sides) required</p>
            <StudentDocumentUploads form={form} setForm={setForm} setError={setError} />

            <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', margin: '0.25rem 0' }} />
            {sectionLabel('Guardian & Emergency Contacts')}
            {CONTACT_FIELDS.map(f => <FieldInput key={f.name} f={f} form={form} setForm={setForm} />)}

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
