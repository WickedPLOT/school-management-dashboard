'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

const FIELDS = [
  { name: 'full_name',     label: 'Full Name',           type: 'text',   span: 2 },
  { name: 'phone',         label: 'Phone Number',        type: 'text' },
  { name: 'parent_name',   label: 'Parent / Guardian',   type: 'text' },
  { name: 'parent_phone',  label: 'Parent Phone',        type: 'text' },
  { name: 'parent_email',  label: 'Parent Email',        type: 'email' },
  { name: 'gender',        label: 'Gender',              type: 'select', options: ['male', 'female'] },
  { name: 'institution',   label: 'Institution',         type: 'text',   span: 2 },
  { name: 'course',        label: 'Course / Programme',  type: 'text' },
  { name: 'year_of_study', label: 'Year of Study',       type: 'number' },
  { name: 'quran_level',   label: "Qur'an Level",        type: 'text' },
  { name: 'home_county',   label: 'Home County',         type: 'text' },
] as const;

const REQUIRED = ['full_name', 'phone', 'institution', 'course'];

export default function StudentProfilePage() {
  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [canEdit, setCanEdit] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch('/profile'),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/admin/settings/public`).then((res) => res.json()).catch(() => null),
    ]).then(([data, publicSettings]) => {
      if (data) {
        setForm(data);
        const incomplete = REQUIRED.some(k => !data[k]);
        setIsFirstTime(incomplete);
      } else {
        setIsFirstTime(true);
      }
      if (publicSettings && publicSettings.allow_student_profile_edits === false) {
        setCanEdit(false);
      }
    }).catch(() => {});
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);
    const missing = REQUIRED.filter(k => !form[k]);
    if (missing.length) { setError(`Please fill in: ${missing.join(', ').replace(/_/g, ' ')}`); return; }
    try {
      await apiFetch('/profile', { method: 'PUT', body: JSON.stringify(form) });
      setSaved(true);
      setIsFirstTime(false);
    } catch (err: any) {
      setError(err.message);
    }
  }

  const displayName = form.full_name || 'Student Profile';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'SP';
  const profileChips = [
    'Active',
    form.gender === 'female' ? 'Room S-2A' : 'Room D1-A',
    form.quran_level || 'Advanced Qur’an',
  ];
  const extraReadOnlyFields = [
    ['Father/Guardian', 'Hassan Omar'],
    ['Mother Name', 'Fatuma Ali'],
    ['Emergency Contact', '+254 700 111 222'],
    ['Student ID', 'UON/2023/1234'],
  ] as const;

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Student Profile</h1>
        <p>Full profile with tabbed sections — Personal, Academic, Room, Progress</p>
      </div>

      {isFirstTime && (
        <div style={{
          background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
          borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem', color: 'white',
        }}>
          <p style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Welcome to Hayrat Centre</p>
          <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>
            Please complete your profile before accessing other features. Fields marked * are required.
          </p>
        </div>
      )}

      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Student Profile</h2>
            <p>Viewing: {displayName}</p>
          </div>
          <button type="button" className="profile-action">
            ↔ Message Student
          </button>
        </div>

        <div style={{ padding: '1rem' }}>
          <div className="profile-hero">
            <div className="profile-identity">
              <div className="profile-avatar">{initials}</div>
              <div>
                <h3>{displayName}</h3>
                <p>
                  {form.email || 'abdullahi@gmail.com'} · {form.section || 'Brothers Section'}
                </p>
                <div className="profile-pill-row">
                  {profileChips.map((chip) => (
                    <span key={chip} className="profile-pill">{chip}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="profile-tabs">
            <div className="profile-tab active">Personal Info</div>
            <div className="profile-tab">Academic</div>
            <div className="profile-tab">Room &amp; Roommates</div>
            <div className="profile-tab">Qur&apos;an Progress</div>
            <div className="profile-tab">Attendance</div>
          </div>

          {saved && <div className="success-msg" style={{ marginBottom: '1.25rem' }}>Profile saved successfully.</div>}
          {error && <div className="error-msg"   style={{ marginBottom: '1.25rem' }}>{error}</div>}
          {!canEdit && <div className="error-msg" style={{ marginBottom: '1.25rem' }}>Profile editing is currently disabled by the administrator.</div>}

          <form onSubmit={handleSubmit} style={{ marginTop: '1rem' }}>
            <div className="profile-detail-grid">
              {FIELDS.map(f => (
                <div key={f.name} className="profile-detail" style={'span' in f && f.span === 2 ? { gridColumn: 'span 1' } : {}}>
                  <label>
                    {f.label}
                    {REQUIRED.includes(f.name) && <span style={{ color: '#dc2626', marginLeft: 2 }}>*</span>}
                  </label>
                  {f.type === 'select' ? (
                    <select disabled={!canEdit} value={form[f.name] || ''} onChange={e => setForm({ ...form, [f.name]: e.target.value })}>
                      <option value="">Select...</option>
                      {'options' in f && f.options.map((o: string) => (
                        <option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      placeholder={f.label}
                      value={form[f.name] || ''}
                      disabled={!canEdit}
                      onChange={e => setForm({ ...form, [f.name]: e.target.value })}
                    />
                  )}
                </div>
              ))}

              {extraReadOnlyFields.map(([label, value]) => (
                <div key={label} className="profile-detail">
                  <label>{label}</label>
                  <input value={value} readOnly />
                </div>
              ))}
            </div>

            <div className="profile-form-actions">
              <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '1.5rem' }} disabled={!canEdit}>
                Save Profile
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
