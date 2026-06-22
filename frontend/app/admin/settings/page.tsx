'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from '@/lib/centers';

type AppSettings = {
  centre_name: string;
  platform_label: string;
  support_email: string;
  registration_invite_expiry_days: number | string;
  approval_required: boolean;
  allow_student_profile_edits: boolean;
  attendance_late_weight: number | string;
  attendance_warning_threshold: number | string;
  default_event_section_scope: 'brothers' | 'sisters' | 'all';
};

const DEFAULT_SETTINGS: AppSettings = {
  centre_name: 'Centre of Suffa',
  platform_label: 'Student Resident Management System',
  support_email: '',
  registration_invite_expiry_days: 7,
  approval_required: true,
  allow_student_profile_edits: true,
  attendance_late_weight: 0.5,
  attendance_warning_threshold: 60,
  default_event_section_scope: 'brothers',
};

function normalizeSettings(data: Partial<AppSettings> | null | undefined): AppSettings {
  return {
    centre_name: data?.centre_name ?? DEFAULT_SETTINGS.centre_name,
    platform_label: data?.platform_label ?? DEFAULT_SETTINGS.platform_label,
    support_email: data?.support_email ?? DEFAULT_SETTINGS.support_email,
    registration_invite_expiry_days: data?.registration_invite_expiry_days ?? DEFAULT_SETTINGS.registration_invite_expiry_days,
    approval_required: data?.approval_required ?? DEFAULT_SETTINGS.approval_required,
    allow_student_profile_edits: data?.allow_student_profile_edits ?? DEFAULT_SETTINGS.allow_student_profile_edits,
    attendance_late_weight: data?.attendance_late_weight ?? DEFAULT_SETTINGS.attendance_late_weight,
    attendance_warning_threshold: data?.attendance_warning_threshold ?? DEFAULT_SETTINGS.attendance_warning_threshold,
    default_event_section_scope: data?.default_event_section_scope ?? DEFAULT_SETTINGS.default_event_section_scope,
  };
}

export default function Page() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    apiFetch('/admin/settings')
      .then((data) => {
        setSettings(normalizeSettings(data));
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...settings,
          registration_invite_expiry_days: Number(settings.registration_invite_expiry_days),
          attendance_late_weight: Number(settings.attendance_late_weight),
          attendance_warning_threshold: Number(settings.attendance_warning_threshold),
        }),
      });
      setSuccess('System settings saved.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Working system settings for registration, attendance scoring, and platform defaults</p>
      </div>

      <form onSubmit={save} className="form-stack">
        <div className="settings-grid">
          <div className="settings-panel-stack">
            <div className="section-outline">
              <div className="section-outline-header">
                <div>
                  <h2>General</h2>
                  <p>Core platform identity and contact information</p>
                </div>
              </div>
              <div style={{ padding: '1rem' }} className="form-stack">
                <div className="form-grid">
                  <div className="field">
                    <label>Centre Name</label>
                    <input value={settings.centre_name} onChange={(e) => update('centre_name', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Platform Label</label>
                    <input value={settings.platform_label} onChange={(e) => update('platform_label', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>Support Email</label>
                    <input value={settings.support_email} onChange={(e) => update('support_email', e.target.value)} placeholder="support@example.com" />
                  </div>
                </div>
              </div>
            </div>

            <div className="section-outline">
              <div className="section-outline-header">
                <div>
                  <h2>Registration</h2>
                  <p>How invite links and student approvals are handled</p>
                </div>
              </div>
              <div style={{ padding: '1rem' }} className="form-stack">
                <div className="form-grid">
                  <div className="field">
                    <label>Invite Expiry Days</label>
                    <input value={settings.registration_invite_expiry_days} onChange={(e) => update('registration_invite_expiry_days', e.target.value)} />
                  </div>
                  <div className="field">
                    <label>
                      <input type="checkbox" checked={settings.approval_required} onChange={(e) => update('approval_required', e.target.checked)} style={{ marginRight: 8 }} />
                      Require admin approval for registration
                    </label>
                  </div>
                  <div className="field">
                    <label>
                      <input type="checkbox" checked={settings.allow_student_profile_edits} onChange={(e) => update('allow_student_profile_edits', e.target.checked)} style={{ marginRight: 8 }} />
                      Allow students to edit their profiles
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="section-outline">
              <div className="section-outline-header">
                <div>
                  <h2>Attendance</h2>
                  <p>Scoring rules used by the event attendance register and profile summaries</p>
                </div>
              </div>
              <div style={{ padding: '1rem' }} className="form-stack">
                <div className="form-grid">
                  <div className="field">
                    <label>Late Attendance Weight</label>
                    <input value={settings.attendance_late_weight} onChange={(e) => update('attendance_late_weight', e.target.value)} placeholder="0.5" />
                  </div>
                  <div className="field">
                    <label>Warning Threshold (%)</label>
                    <input value={settings.attendance_warning_threshold} onChange={(e) => update('attendance_warning_threshold', e.target.value)} placeholder="60" />
                  </div>
                  <div className="field">
                    <label>Default Event Section Scope</label>
                    <select value={settings.default_event_section_scope} onChange={(e) => update('default_event_section_scope', e.target.value as AppSettings['default_event_section_scope'])}>
                      <option value="brothers">{BROTHERS_CENTER_NAME}</option>
                      <option value="sisters">{SISTERS_CENTER_NAME}</option>
                      <option value="all">Both Centers</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {error && <div className="error-msg">{error}</div>}
            {success && <div className="success-msg">{success}</div>}

            <div className="profile-form-actions">
              <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '1.5rem' }} disabled={saving || loading}>
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>

          <aside className="credit-panel">
            <div>
              <h2 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--green)' }}>Settings Guide</h2>
              <p className="credit-note">These settings are live system values, not placeholders. Attendance rates and register defaults will follow what you save here.</p>
            </div>
            <div className="credit-list">
              <div className="credit-list-item">
                <strong>Invite expiry</strong>
                <span>Controls how many days registration links remain valid before the backend rejects them.</span>
              </div>
              <div className="credit-list-item">
                <strong>Late weight</strong>
                <span>A value of `0.5` means a late student earns half credit when attendance rate is calculated.</span>
              </div>
              <div className="credit-list-item">
                <strong>Warning threshold</strong>
                <span>Students whose attendance falls below this score can be flagged in future reporting views.</span>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </div>
  );
}
