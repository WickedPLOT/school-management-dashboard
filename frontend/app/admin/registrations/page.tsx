'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { Icons } from '@/lib/icons';
import Link from 'next/link';

type User = {
  id: number; email: string; section: string; status: string; created_at: string;
  full_name?: string; gender?: string; institution?: string;
};
type Invite = { email: string; link: string };
type Stats = { pending: number; approved: number; rejected: number; incomplete: number };

export default function RegistrationsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite mode: 'single' | 'bulk'
  const [mode, setMode] = useState<'single' | 'bulk'>('single');

  // Single link
  const [singleLink, setSingleLink] = useState('');
  const [singleGenerating, setSingleGenerating] = useState(false);
  const [singleCopied, setSingleCopied] = useState(false);

  // Bulk
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const [emailError, setEmailError] = useState('');
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  async function load() {
    try {
      const [pendingUsers, dashboardStats] = await Promise.all([
        apiFetch('/admin/pending-users'),
        apiFetch('/admin/dashboard'),
      ]);
      setUsers(pendingUsers);
      setStats(dashboardStats);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }

  async function action(id: number, type: 'approve' | 'reject') {
    try {
      await apiFetch(`/admin/${type}/${id}`, { method: 'PATCH' });
      setUsers(u => u.filter(x => x.id !== id));
    } catch (err: any) { setError(err.message); }
  }

  // Single: generate one link with no email
  async function generateSingle() {
    setSingleGenerating(true);
    setSingleLink('');
    setSingleCopied(false);
    try {
      const data = await apiFetch('/admin/invite/single', { method: 'POST' });
      setSingleLink(data.link);
    } catch (err: any) { setError(err.message); }
    finally { setSingleGenerating(false); }
  }

  function copySingle() {
    navigator.clipboard.writeText(singleLink);
    setSingleCopied(true);
    setTimeout(() => setSingleCopied(false), 2500);
  }

  // Bulk
  function addEmails() {
    setEmailError('');
    const raw = emailInput.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
    const invalid = raw.filter(e => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    if (invalid.length) { setEmailError(`Invalid: ${invalid.join(', ')}`); return; }
    setEmailList(Array.from(new Set([...emailList, ...raw])));
    setEmailInput('');
  }

  async function generateBulk() {
    if (!emailList.length) { setEmailError('Add at least one email'); return; }
    setBulkGenerating(true);
    setInvites([]);
    try {
      const data = await apiFetch('/admin/invite', { method: 'POST', body: JSON.stringify({ emails: emailList }) });
      setInvites(data.invites);
      setEmailList([]);
    } catch (err: any) { setEmailError(err.message); }
    finally { setBulkGenerating(false); }
  }

  function copyLink(link: string, idx: number) {
    navigator.clipboard.writeText(link);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2500);
  }

  function copyAll() {
    navigator.clipboard.writeText(invites.map(i => `${i.email}: ${i.link}`).join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2500);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div className="page-header">
        <h1>Registrations</h1>
        <p>Generate student registration links, approve accounts, and review registration status.</p>
      </div>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        {[
          { label: 'Pending Approvals', value: stats?.pending, icon: Icons.students, color: '#fef3c7', href: '/admin/students/pending' },
          { label: 'Approved Students', value: stats?.approved, icon: Icons.students, color: '#d1fae5', href: '/admin/students/all' },
          { label: 'Rejected Accounts', value: stats?.rejected, icon: Icons.students, color: '#fee2e2', href: '/admin/students/rejected' },
          { label: 'Incomplete Profiles', value: stats?.incomplete, icon: Icons.profile, color: '#fef3c7', href: '/admin/profiles/incomplete' },
        ].map((card) => (
          <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer' }}>
              <div className="stat-icon" style={{ background: card.color }}>{card.icon}</div>
              <div>
                <h3>{loading ? '—' : card.value}</h3>
                <p>{card.label}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Invite card */}
      <div className="content-card" style={{ marginBottom: '1.5rem' }}>
        <div className="content-card-header">
          <h2>Generate Registration Link</h2>
          {/* Toggle */}
          <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: '0.5rem', padding: '0.2rem', gap: '0.2rem' }}>
            {(['single', 'bulk'] as const).map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setSingleLink(''); setInvites([]); setEmailList([]); setEmailError(''); }}
                style={{
                  padding: '0.3rem 0.875rem',
                  borderRadius: '0.375rem',
                  border: 'none',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: mode === m ? 'white' : 'transparent',
                  color: mode === m ? 'var(--green)' : 'var(--muted)',
                  boxShadow: mode === m ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                {m === 'single' ? 'Single Link' : 'Bulk / Email'}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: '1.25rem 1.5rem' }}>
          {/* ── Single mode ── */}
          {mode === 'single' && (
            <>
              <p style={{ fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Generate one registration link with no email attached. Share it with a single student.
                The link is single-use and expires in 7 days.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  className="btn-primary"
                  style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
                  onClick={generateSingle}
                  disabled={singleGenerating}
                >
                  {singleGenerating ? 'Generating...' : 'Generate Link'}
                </button>
                {singleLink && (
                  <>
                    <input
                      readOnly value={singleLink}
                      onClick={e => (e.target as HTMLInputElement).select()}
                      style={{
                        flex: 1, minWidth: 220,
                        border: '1.5px solid var(--border)', borderRadius: '0.625rem',
                        padding: '0.6rem 0.875rem', fontSize: '0.8rem',
                        background: '#f9fafb', fontFamily: 'monospace',
                      }}
                    />
                    <button
                      onClick={copySingle}
                      style={{
                        background: singleCopied ? '#d1fae5' : 'var(--green-light)',
                        color: singleCopied ? '#065f46' : 'var(--green)',
                        border: 'none', borderRadius: '0.625rem',
                        padding: '0.6rem 1rem', fontSize: '0.8rem', fontWeight: 600,
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {singleCopied ? 'Copied!' : 'Copy Link'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {/* ── Bulk mode ── */}
          {mode === 'bulk' && (
            <>
              <p style={{ fontSize: '0.825rem', color: 'var(--muted)', marginBottom: '1rem' }}>
                Enter email addresses to generate a unique link per person. Separate by comma, space, or newline.
              </p>
              <div style={{ display: 'flex', gap: '0.625rem', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="e.g. ali@gmail.com, fatuma@gmail.com"
                  value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addEmails(); } }}
                  style={{
                    flex: 1, minWidth: 240,
                    border: '1.5px solid var(--border)', borderRadius: '0.625rem',
                    padding: '0.625rem 0.875rem', fontSize: '0.875rem',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={addEmails}
                  style={{
                    background: 'var(--green-light)', color: 'var(--green)',
                    border: 'none', borderRadius: '0.625rem',
                    padding: '0.625rem 1.125rem', fontWeight: 600, fontSize: '0.825rem', cursor: 'pointer',
                  }}
                >
                  Add
                </button>
              </div>

              {emailError && <div className="error-msg" style={{ marginTop: '0.625rem' }}>{emailError}</div>}

              {emailList.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.875rem' }}>
                  {emailList.map(e => (
                    <span key={e} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
                      background: '#f3f4f6', borderRadius: '999px',
                      padding: '0.25rem 0.625rem 0.25rem 0.875rem',
                      fontSize: '0.775rem', fontWeight: 500,
                    }}>
                      {e}
                      <button
                        onClick={() => setEmailList(l => l.filter(x => x !== e))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem', lineHeight: 1, padding: 0 }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}

              {emailList.length > 0 && (
                <button
                  className="btn-primary"
                  style={{ marginTop: '1rem', width: 'auto', padding: '0.625rem 1.5rem' }}
                  onClick={generateBulk}
                  disabled={bulkGenerating}
                >
                  {bulkGenerating ? 'Generating...' : `Generate ${emailList.length} Link${emailList.length > 1 ? 's' : ''}`}
                </button>
              )}

              {invites.length > 0 && (
                <div style={{ marginTop: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.625rem' }}>
                    <p style={{ fontSize: '0.825rem', fontWeight: 600 }}>{invites.length} link{invites.length > 1 ? 's' : ''} generated</p>
                    <button
                      onClick={copyAll}
                      style={{ background: 'none', border: 'none', color: 'var(--green)', fontSize: '0.775rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      {copiedAll ? 'Copied!' : 'Copy All'}
                    </button>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {invites.map((inv, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: '0.625rem',
                        background: '#f9fafb', borderRadius: '0.625rem',
                        padding: '0.625rem 0.875rem', flexWrap: 'wrap',
                      }}>
                        <span style={{ fontSize: '0.775rem', fontWeight: 600, minWidth: 160 }}>{inv.email}</span>
                        <input
                          readOnly value={inv.link}
                          onClick={e => (e.target as HTMLInputElement).select()}
                          style={{
                            flex: 1, minWidth: 180,
                            border: '1px solid var(--border)', borderRadius: '0.5rem',
                            padding: '0.375rem 0.625rem', fontSize: '0.75rem',
                            background: 'white', fontFamily: 'monospace',
                          }}
                        />
                        <button
                          onClick={() => copyLink(inv.link, idx)}
                          style={{
                            background: copiedIdx === idx ? '#d1fae5' : 'var(--green-light)',
                            color: copiedIdx === idx ? '#065f46' : 'var(--green)',
                            border: 'none', borderRadius: '0.5rem',
                            padding: '0.375rem 0.75rem', fontSize: '0.775rem', fontWeight: 600,
                            cursor: 'pointer', whiteSpace: 'nowrap',
                          }}
                        >
                          {copiedIdx === idx ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div className="stat-icon">{Icons.students}</div>
          <div>
            <h3>{loading ? '—' : users.length}</h3>
            <p>Awaiting Review</p>
          </div>
        </div>
      </div>

      {/* Pending list */}
      <div className="content-card">
        <div className="content-card-header">
          <h2>Pending Applications</h2>
          <span>{!loading && `${users.length} pending`}</span>
        </div>
        {loading && <div className="empty-state"><p>Loading...</p></div>}
        {error   && <div style={{ padding: '1.5rem' }}><div className="error-msg">{error}</div></div>}
        {!loading && !error && users.length === 0 && (
          <div className="empty-state">{Icons.students}<p>No pending registrations at this time.</p></div>
        )}
        {users.map(u => (
          <div key={u.id} className="reg-item">
            <div className="reg-item-left">
              <div className="avatar">{(u.full_name || u.email)[0].toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div className="reg-email">{u.full_name || '—'}</div>
                <div style={{ fontSize: '0.775rem', color: 'var(--muted)', marginTop: '0.1rem' }}>{u.email}</div>
                <div className="reg-meta" style={{ marginTop: '0.3rem' }}>
                  <span className={`badge badge-${u.section}`}>{u.section}</span>
                  {u.gender && <span className="badge" style={{ background: '#f3f4f6', color: '#374151' }}>{u.gender}</span>}
                  {u.institution && <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{u.institution}</span>}
                  <span className="reg-date">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              </div>
            </div>
            <div className="reg-item-actions">
              <button className="btn-approve" onClick={() => action(u.id, 'approve')}>Approve</button>
              <button className="btn-reject"  onClick={() => action(u.id, 'reject')}>Reject</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
