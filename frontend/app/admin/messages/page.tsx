'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import PasswordInput from '@/components/PasswordInput';

type Settings = {
  sms_enabled: boolean;
  sms_provider: string;
  at_username: string;
  at_api_key: string;
  at_sender_id: string;
  at_use_sandbox: boolean;
  at_paybill_number: string;
  at_wallet_reference: string;
  at_balance_currency: string;
  at_credit_balance: number | string;
  at_topup_notes: string;
  live_balance: number | null;
  live_balance_currency: string;
  live_balance_raw: string | null;
  live_balance_source: string;
  live_balance_error: string | null;
  email_enabled: boolean;
  smtp_host: string;
  smtp_port: number | string;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_pass: string;
  smtp_from_name: string;
  smtp_from_email: string;
};

type HistoryRow = {
  id: number;
  audience: string;
  channel: string;
  subject?: string;
  status: string;
  recipient_count: number;
  success_count: number;
  failure_count: number;
  created_by_email?: string;
  created_at: string;
};

const EMPTY_SETTINGS: Settings = {
  sms_enabled: false,
  sms_provider: 'africastalking',
  at_username: '',
  at_api_key: '',
  at_sender_id: '',
  at_use_sandbox: true,
  at_paybill_number: '',
  at_wallet_reference: '',
  at_balance_currency: 'KES',
  at_credit_balance: '',
  at_topup_notes: '',
  live_balance: null,
  live_balance_currency: 'KES',
  live_balance_raw: null,
  live_balance_source: 'unavailable',
  live_balance_error: null,
  email_enabled: false,
  smtp_host: '',
  smtp_port: 587,
  smtp_secure: false,
  smtp_user: '',
  smtp_pass: '',
  smtp_from_name: 'HAYRAT CENTER',
  smtp_from_email: '',
};

export default function Page() {
  const [settings, setSettings] = useState<Settings>(EMPTY_SETTINGS);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/admin/messages/settings'),
      apiFetch('/admin/messages/history'),
    ])
      .then(([settingsData, historyData]) => {
        setSettings({
          ...EMPTY_SETTINGS,
          ...settingsData,
          at_username: settingsData.at_username ?? '',
          at_api_key: settingsData.at_api_key ?? '',
          at_sender_id: settingsData.at_sender_id ?? '',
          at_paybill_number: settingsData.at_paybill_number ?? '',
          at_wallet_reference: settingsData.at_wallet_reference ?? '',
          at_balance_currency: settingsData.at_balance_currency ?? 'KES',
          at_credit_balance: settingsData.at_credit_balance ?? '',
          at_topup_notes: settingsData.at_topup_notes ?? '',
          live_balance: settingsData.live_balance ?? null,
          live_balance_currency: settingsData.live_balance_currency ?? 'KES',
          live_balance_raw: settingsData.live_balance_raw ?? null,
          live_balance_source: settingsData.live_balance_source ?? 'unavailable',
          live_balance_error: settingsData.live_balance_error ?? null,
          smtp_host: settingsData.smtp_host ?? '',
          smtp_port: settingsData.smtp_port ?? 587,
          smtp_user: settingsData.smtp_user ?? '',
          smtp_pass: settingsData.smtp_pass ?? '',
          smtp_from_name: settingsData.smtp_from_name ?? 'HAYRAT CENTER',
          smtp_from_email: settingsData.smtp_from_email ?? '',
        });
        setHistory(historyData);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await apiFetch('/admin/messages/settings', {
        method: 'PUT',
        body: JSON.stringify({
          ...settings,
          smtp_port: Number(settings.smtp_port),
          at_credit_balance: settings.at_credit_balance === '' ? null : Number(settings.at_credit_balance),
        }),
      });
      setSettings((current) => ({
        ...current,
        ...updated,
        at_username: updated.at_username ?? '',
        at_api_key: updated.at_api_key ?? '',
        at_sender_id: updated.at_sender_id ?? '',
        at_paybill_number: updated.at_paybill_number ?? '',
        at_wallet_reference: updated.at_wallet_reference ?? '',
        at_topup_notes: updated.at_topup_notes ?? '',
        live_balance: updated.live_balance ?? null,
        live_balance_currency: updated.live_balance_currency ?? current.live_balance_currency,
        live_balance_raw: updated.live_balance_raw ?? null,
        live_balance_source: updated.live_balance_source ?? 'unavailable',
        live_balance_error: updated.live_balance_error ?? null,
      }));
      setSuccess('Communication settings saved.');
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
  }

  const balanceLabel = settings.live_balance == null
    ? 'Unavailable'
    : `${settings.live_balance_currency || 'KES'} ${settings.live_balance.toLocaleString()}`;

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Configure SMTP and Africa&apos;s Talking, then send official broadcasts</p>
      </div>

      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Provider Setup</h2>
            <p>The client manages SMS credit inside Africa&apos;s Talking. This page stores the credentials and top-up instructions for admins.</p>
          </div>
        </div>

        <form onSubmit={saveSettings} style={{ padding: '1rem 1.25rem 1.25rem' }} className="form-stack">
          <div className="settings-grid">
            <div className="settings-panel-stack">
              <div className="form-grid">
                <div className="field">
                  <label>
                    <input type="checkbox" checked={settings.sms_enabled} onChange={(e) => update('sms_enabled', e.target.checked)} style={{ marginRight: 8 }} />
                    Enable SMS
                  </label>
                </div>
                <div className="field">
                  <label>
                    <input type="checkbox" checked={settings.email_enabled} onChange={(e) => update('email_enabled', e.target.checked)} style={{ marginRight: 8 }} />
                    Enable Email
                  </label>
                </div>
              </div>

              <div className="section-outline" style={{ background: '#fafcfb' }}>
                <div className="section-outline-header">
                  <div>
                    <h2>Africa&apos;s Talking SMS</h2>
                    <p>Used for broadcast SMS to students, parents, or both</p>
                  </div>
                </div>
                <div style={{ padding: '1rem' }} className="form-stack">
                  <div className="form-grid">
                    <div className="field">
                      <label>Username</label>
                      <input value={settings.at_username} onChange={(e) => update('at_username', e.target.value)} placeholder="Africa's Talking username" />
                    </div>
                    <div className="field">
                      <label>Sender ID</label>
                      <input value={settings.at_sender_id} onChange={(e) => update('at_sender_id', e.target.value)} placeholder="Optional sender ID" />
                    </div>
                    <div className="field">
                      <label>Paybill Number</label>
                      <input value={settings.at_paybill_number} onChange={(e) => update('at_paybill_number', e.target.value)} placeholder="e.g. 525900" />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label>API Key</label>
                      <input value={settings.at_api_key} onChange={(e) => update('at_api_key', e.target.value)} placeholder="Africa's Talking API key" />
                    </div>
                    <div className="field">
                      <label>Account Number</label>
                      <input value={settings.at_wallet_reference} onChange={(e) => update('at_wallet_reference', e.target.value)} placeholder="Africa's Talking account number" />
                    </div>
                    <div className="field">
                      <label>Balance Currency</label>
                      <input value={settings.at_balance_currency} onChange={(e) => update('at_balance_currency', e.target.value)} placeholder="KES" />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label>
                        <input type="checkbox" checked={settings.at_use_sandbox} onChange={(e) => update('at_use_sandbox', e.target.checked)} style={{ marginRight: 8 }} />
                        Use Sandbox
                      </label>
                    </div>
                  </div>
                  <div className="field">
                    <label>Top-up / Finance Notes</label>
                    <textarea rows={4} value={settings.at_topup_notes} onChange={(e) => update('at_topup_notes', e.target.value)} placeholder="Client-side instructions for loading SMS wallet credit" />
                  </div>
                </div>
              </div>

              <div className="section-outline" style={{ background: '#fafcfb' }}>
                <div className="section-outline-header">
                  <div>
                    <h2>SMTP Email</h2>
                    <p>Used for verification codes and official communications</p>
                  </div>
                </div>
                <div style={{ padding: '1rem' }} className="form-stack">
                  <div className="form-grid">
                    <div className="field">
                      <label>SMTP Host</label>
                      <input value={settings.smtp_host} onChange={(e) => update('smtp_host', e.target.value)} placeholder="smtp.example.com" />
                    </div>
                    <div className="field">
                      <label>SMTP Port</label>
                      <input value={settings.smtp_port} onChange={(e) => update('smtp_port', e.target.value)} placeholder="587" />
                    </div>
                    <div className="field">
                      <label>SMTP User</label>
                      <input value={settings.smtp_user} onChange={(e) => update('smtp_user', e.target.value)} placeholder="SMTP username" />
                    </div>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label>SMTP Password</label>
                      <PasswordInput value={settings.smtp_pass} onChange={(e) => update('smtp_pass', e.target.value)} placeholder="SMTP password" />
                    </div>
                    <div className="field">
                      <label>From Name</label>
                      <input value={settings.smtp_from_name} onChange={(e) => update('smtp_from_name', e.target.value)} placeholder="HAYRAT CENTER" />
                    </div>
                    <div className="field">
                      <label>From Email</label>
                      <input value={settings.smtp_from_email} onChange={(e) => update('smtp_from_email', e.target.value)} placeholder="noreply@example.com" />
                    </div>
                  </div>
                  <div className="field">
                    <label>
                      <input type="checkbox" checked={settings.smtp_secure} onChange={(e) => update('smtp_secure', e.target.checked)} style={{ marginRight: 8 }} />
                      Use secure SMTP
                    </label>
                  </div>
                </div>
              </div>

              {error && <div className="error-msg">{error}</div>}
              {success && <div className="success-msg">{success}</div>}

              <div className="profile-form-actions">
                <button type="submit" className="btn-primary" style={{ width: 'auto', paddingInline: '1.5rem' }} disabled={saving || loading}>
                  {saving ? 'Saving...' : 'Save Provider Settings'}
                </button>
              </div>
            </div>

            <aside className="credit-panel">
              <div>
                <h2 style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--green)' }}>SMS Credit</h2>
                <p className="credit-note">
                  Wallet balance is fetched from Africa&apos;s Talking using the saved username and API key. Top-up instructions stay here for the admin team.
                </p>
              </div>
              <div className="credit-balance">
                <strong>{balanceLabel}</strong>
                <span>
                  {settings.live_balance_source === 'provider' ? 'Live provider balance' : settings.live_balance_source === 'cached' ? 'Cached fallback balance' : 'Balance not available yet'}
                </span>
              </div>
              {settings.live_balance_error && (
                <div className="credit-note" style={{ color: '#b45309' }}>
                  {settings.live_balance_error}
                </div>
              )}
              <div className="credit-actions">
                <a className="btn-outline" href="https://account.africastalking.com/" target="_blank" rel="noreferrer">
                  Open AT Account
                </a>
                <a className="btn-outline" href="https://help.africastalking.com/" target="_blank" rel="noreferrer">
                  Top-up Help
                </a>
              </div>
              <div className="credit-list">
                <div className="credit-list-item">
                  <strong>M-Pesa Paybill</strong>
                  <span>{settings.at_paybill_number || 'No paybill number saved yet.'}</span>
                </div>
                <div className="credit-list-item">
                  <strong>Account Number</strong>
                  <span>{settings.at_wallet_reference || 'No account number saved yet.'}</span>
                </div>
                <div className="credit-list-item">
                  <strong>Top-up Steps</strong>
                  <span>
                    1. On the M-Pesa menu choose Pay Bill. 2. Enter the paybill number shown here. 3. Enter the account number shown here. 4. Enter the amount to load. 5. Confirm payment, then refresh this page.
                  </span>
                </div>
                <div className="credit-list-item">
                  <strong>Finance Notes</strong>
                  <span>{settings.at_topup_notes || 'No finance instructions saved yet.'}</span>
                </div>
              </div>
            </aside>
          </div>
        </form>
      </div>

      <div className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Recent Broadcasts</h2>
            <p>Delivery history across SMS and email</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><p>Loading...</p></div>
        ) : history.length === 0 ? (
          <div className="empty-state"><p>No broadcasts have been sent yet.</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Created</th>
                  <th>Audience</th>
                  <th>Channel</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th>Success</th>
                  <th>Failed</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className="table-muted">
                      {new Date(row.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ textTransform: 'capitalize' }}>{row.audience}</td>
                    <td style={{ textTransform: 'capitalize' }}>{row.channel}</td>
                    <td>{row.subject || '—'}</td>
                    <td><span className={`badge badge-${row.status}`}>{row.status}</span></td>
                    <td>{row.recipient_count}</td>
                    <td>{row.success_count}</td>
                    <td>{row.failure_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
