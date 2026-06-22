'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import Modal from '@/components/Modal';

type Resource = {
  id: number;
  title: string;
  category: string;
  description?: string;
  resource_type: 'link' | 'file' | 'note';
  external_url?: string;
  file_name?: string;
  file_data?: string;
  note_content?: string;
  created_at: string;
  is_book?: boolean;
  book_id?: number;
  total_pages?: number;
};

type ReadingProgress = {
  id: number;
  resource_id: number;
  progress: number;
  status: 'not_started' | 'reading' | 'completed';
  pages_read: number;
  total_pages: number | null;
  notes: string | null;
  updated_at: string;
};

type ProgressMap = Record<number, ReadingProgress>;

function isEmbeddableFile(resource: Resource) {
  const fileName = (resource.file_name || '').toLowerCase();
  const fileData = (resource.file_data || '').toLowerCase();
  return (
    fileName.endsWith('.pdf') ||
    fileName.endsWith('.png') ||
    fileName.endsWith('.jpg') ||
    fileName.endsWith('.jpeg') ||
    fileName.endsWith('.gif') ||
    fileName.endsWith('.webp') ||
    fileData.startsWith('data:application/pdf') ||
    fileData.startsWith('data:image/')
  );
}

function getStatusLabel(status: string) {
  if (status === 'completed') return 'Completed';
  if (status === 'reading') return 'Reading';
  return 'Not Started';
}

function getStatusColor(status: string) {
  if (status === 'completed') return 'badge-approved';
  if (status === 'reading') return 'badge-pending';
  return '';
}

export default function Page() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [progressMap, setProgressMap] = useState<ProgressMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [activeResource, setActiveResource] = useState<Resource | null>(null);
  const [progressForm, setProgressForm] = useState({ progress: 0, status: 'not_started', pages_read: 0, total_pages: 0, notes: '' });
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch('/profile/resources'),
      apiFetch('/profile/reading-progress'),
      apiFetch('/student/books'),
    ])
      .then(([resourcesData, progressData, booksData]) => {
        // Convert books to resource format for compatibility
        const booksAsResources = booksData.map((book: any) => ({
          id: -book.id, // Negative ID to distinguish from regular resources
          title: book.title,
          category: 'Books',
          description: book.description,
          resource_type: 'file' as const,
          file_name: book.file_name,
          file_data: book.file_data ? `data:application/pdf;base64,${book.file_data}` : null,
          created_at: book.created_at,
          is_book: true,
          book_id: book.id,
          total_pages: book.total_pages,
        }));
        setResources([...booksAsResources, ...resourcesData]);
        const map: ProgressMap = {};
        (progressData as ReadingProgress[]).forEach((p) => { map[p.resource_id] = p; });
        setProgressMap(map);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => Array.from(new Set(resources.map((item) => item.category))), [resources]);
  const filtered = useMemo(() => resources.filter((item) => {
    const matchesSearch = `${item.title} ${item.description || ''} ${item.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    return matchesSearch && matchesCategory;
  }), [resources, search, category]);

  const canPreview = (resource: Resource) => (
    resource.resource_type === 'note' ||
    Boolean(resource.external_url) ||
    Boolean(resource.file_data && isEmbeddableFile(resource))
  );

  function openReader(resource: Resource) {
    setActiveResource(resource);
    const p = progressMap[resource.id];
    setProgressForm({
      progress: p?.progress ?? 0,
      status: p?.status ?? 'not_started',
      pages_read: p?.pages_read ?? 0,
      total_pages: p?.total_pages ?? 0,
      notes: p?.notes ?? '',
    });
    setProgressMsg('');
  }

  async function saveProgress() {
    if (!activeResource) return;
    setSavingProgress(true);
    setProgressMsg('');
    try {
      let updated;
      
      // Check if it's a book (negative ID) or regular resource
      if (activeResource.is_book) {
        updated = await apiFetch('/profile/book-progress', {
          method: 'PUT',
          body: JSON.stringify({
            book_id: activeResource.book_id,
            pages_read: progressForm.pages_read,
            status: progressForm.status,
            notes: progressForm.notes || null,
          }),
        });
      } else {
        updated = await apiFetch('/profile/reading-progress', {
          method: 'PUT',
          body: JSON.stringify({
            resource_id: activeResource.id,
            progress: progressForm.progress,
            status: progressForm.status,
            pages_read: progressForm.pages_read,
            total_pages: progressForm.total_pages || null,
            notes: progressForm.notes || null,
          }),
        });
      }
      
      setProgressMap((current) => ({ ...current, [activeResource.id]: updated }));
      setProgressMsg('Progress saved.');
    } catch (err) {
      if (err instanceof Error) setProgressMsg(`Error: ${err.message}`);
    } finally {
      setSavingProgress(false);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Knowledge Hub</h1>
        <p>Access uploaded materials, links, notes, and study resources. Track your reading progress.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Available Resources</h2>
            <p>Search by title or filter by category.</p>
          </div>
        </div>

        <div className="soft-toolbar" style={{ margin: '1rem' }}>
          <div className="field" style={{ minWidth: 240, flex: 1 }}>
            <label>Search</label>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search resources" />
          </div>
          <div className="field" style={{ minWidth: 200 }}>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
        {loading ? (
          <div className="empty-state"><p>Loading resources...</p></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state"><p>No resources available yet.</p></div>
        ) : (
          <div className="resource-grid">
            {filtered.map((item) => {
              const p = progressMap[item.id];
              return (
                <article key={item.id} className="resource-card">
                  <div className="review-card-head">
                    <div>
                      <h3>{item.title}</h3>
                      <p>{item.category}</p>
                    </div>
                    <span className="badge badge-approved">{item.resource_type}</span>
                  </div>
                  <p className="review-details">{item.description || 'No description provided.'}</p>
                  {item.resource_type === 'note' && item.note_content ? (
                    <p className="review-details">{item.note_content.slice(0, 180)}{item.note_content.length > 180 ? '…' : ''}</p>
                  ) : null}
                  {p ? (
                    <div style={{ margin: '0.5rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 600 }}>{getStatusLabel(p.status)}</span>
                        <span style={{ color: 'var(--muted)' }}>{p.progress}%</span>
                      </div>
                      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${p.progress}%`, background: p.status === 'completed' ? '#16a34a' : '#2563eb', borderRadius: 999, transition: 'width 0.3s ease' }} />
                      </div>
                    </div>
                  ) : null}
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                    <button type="button" onClick={() => openReader(item)} title="View" style={{ width: '34px', height: '34px', border: 'none', borderRadius: '0.5rem', background: 'var(--green)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    </button>
                    {item.file_data ? (
                      <a href={item.file_data} download={item.file_name || item.title} title="Download" style={{ width: '34px', height: '34px', border: 'none', borderRadius: '0.5rem', background: 'var(--green)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                      </a>
                    ) : null}
                    {item.external_url ? <a className="btn-outline" href={item.external_url} target="_blank" rel="noreferrer" style={{ width: 'auto', padding: '0.4rem 0.7rem', fontSize: '0.78rem' }}>Open Link</a> : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Modal open={!!activeResource} onClose={() => setActiveResource(null)} fullScreen>
        {activeResource ? (
          <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)', flexShrink: 0, background: '#fff' }}>
              <div>
                <h2 style={{ fontSize: '1rem', margin: 0 }}>{activeResource.title}</h2>
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', margin: 0 }}>{activeResource.category} · {activeResource.resource_type}</p>
              </div>
              <button type="button" className="btn-outline" onClick={() => setActiveResource(null)} style={{ padding: '0.35rem 0.8rem', fontSize: '0.78rem' }}>Close</button>
            </div>

            {activeResource.file_data && isEmbeddableFile(activeResource) ? (
              <div style={{ flex: 1, background: '#525252', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activeResource.file_data.startsWith('data:image/') ? (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflow: 'auto' }}>
                    <img src={activeResource.file_data} alt={activeResource.title} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  </div>
                ) : (
                  <iframe
                    src={activeResource.file_data}
                    title={activeResource.file_name || activeResource.title}
                    style={{ width: '100%', flex: 1, border: 'none', background: '#525252' }}
                  />
                )}
              </div>
            ) : activeResource.resource_type === 'note' ? (
              <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>
                {activeResource.note_content || 'No note content provided.'}
              </div>
            ) : activeResource.external_url ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <iframe
                  src={activeResource.external_url}
                  title={activeResource.title}
                  style={{ width: '100%', flex: 1, border: 'none', background: '#fff' }}
                />
              </div>
            ) : (
              <div style={{ flex: 1, overflow: 'auto', padding: '1.5rem' }}>
                {activeResource.description && <p style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{activeResource.description}</p>}
              </div>
            )}

            <div style={{ flexShrink: 0, background: '#fff', borderTop: '1px solid #e0e0e0', padding: '0.5rem 1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <select value={progressForm.status} onChange={(e) => setProgressForm((c) => ({ ...c, status: e.target.value }))} style={{ padding: '0.3rem 0.5rem', border: '1px solid var(--border)', borderRadius: '0.4rem', fontSize: '0.78rem' }}>
                <option value="not_started">Not Started</option>
                <option value="reading">Reading</option>
                <option value="completed">Completed</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)', whiteSpace: 'nowrap' }}>Pg:</span>
                <input type="number" min={0} value={progressForm.pages_read} onChange={(e) => setProgressForm((c) => ({ ...c, pages_read: Math.max(0, Number(e.target.value)) }))} style={{ width: '50px', padding: '0.3rem 0.4rem', border: '1px solid var(--border)', borderRadius: '0.4rem', fontSize: '0.78rem' }} />
                <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>/ {activeResource.total_pages || progressForm.total_pages || '—'}</span>
              </div>
              <div style={{ flex: 1, height: '6px', background: '#e5e7eb', borderRadius: '999px', overflow: 'hidden', maxWidth: '200px' }}>
                <div style={{ height: '100%', width: `${Math.min(progressForm.progress, 100)}%`, background: progressForm.status === 'completed' ? '#16a34a' : '#2563eb', borderRadius: '999px', transition: 'width 0.3s' }} />
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>{progressForm.progress}%</span>
              {activeResource.is_book ? (
                <button type="button" className="btn-primary" onClick={saveProgress} disabled={savingProgress} style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>
                  {savingProgress ? '...' : 'Save'}
                </button>
              ) : null}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem' }}>
                {activeResource.file_data ? (
                  <a href={activeResource.file_data} download={activeResource.file_name || activeResource.title} title="Download" style={{ width: '30px', height: '30px', border: 'none', borderRadius: '0.4rem', background: 'var(--green)', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  </a>
                ) : null}
                {activeResource.external_url ? (
                  <a href={activeResource.external_url} target="_blank" rel="noreferrer" className="btn-outline" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}>Open</a>
                ) : null}
              </div>
              {progressMsg ? (
                <span style={{ fontSize: '0.75rem', color: progressMsg.startsWith('Error') ? '#dc2626' : '#16a34a' }}>{progressMsg}</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
