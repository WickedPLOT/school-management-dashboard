'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

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
};

export default function Page() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');

  useEffect(() => {
    apiFetch('/profile/resources')
      .then(setResources)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => Array.from(new Set(resources.map((item) => item.category))), [resources]);
  const filtered = useMemo(() => resources.filter((item) => {
    const matchesSearch = `${item.title} ${item.description || ''} ${item.category}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === 'all' || item.category === category;
    return matchesSearch && matchesCategory;
  }), [resources, search, category]);

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Knowledge Hub</h1>
        <p>Access uploaded materials, links, notes, and study resources shared by the admin team.</p>
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
            {filtered.map((item) => (
              <article key={item.id} className="resource-card">
                <div className="review-card-head">
                  <div>
                    <h3>{item.title}</h3>
                    <p>{item.category}</p>
                  </div>
                  <span className="badge badge-approved">{item.resource_type}</span>
                </div>
                <p className="review-details">{item.description || 'No description provided.'}</p>
                {item.resource_type === 'note' && item.note_content ? <p className="review-details">{item.note_content}</p> : null}
                <div className="event-actions">
                  {item.external_url ? <a className="btn-outline" href={item.external_url} target="_blank" rel="noreferrer">Open Link</a> : null}
                  {item.file_data ? <a className="btn-outline" href={item.file_data} download={item.file_name || item.title}>Download File</a> : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
