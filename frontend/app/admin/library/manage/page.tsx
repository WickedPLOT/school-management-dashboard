'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Resource = {
  id: number;
  title: string;
  category: string;
  audience: 'students' | 'admins' | 'both';
  section_scope: 'brothers' | 'sisters' | 'all';
  resource_type: 'link' | 'file' | 'note';
  is_published: boolean;
  created_at: string;
};

export default function Page() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await apiFetch('/admin/resources');
      setResources(data);
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublished(resource: Resource) {
    try {
      const updated = await apiFetch(`/admin/resources/${resource.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          ...resource,
          is_published: !resource.is_published,
        }),
      });
      setResources((current) => current.map((item) => item.id === resource.id ? updated : item));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  async function removeResource(id: number) {
    try {
      await apiFetch(`/admin/resources/${id}`, { method: 'DELETE' });
      setResources((current) => current.filter((item) => item.id !== id));
    } catch (err) {
      if (err instanceof Error) setError(err.message);
    }
  }

  return (
    <div className="section-shell">
      <div className="page-header">
        <h1>Manage Knowledge Hub</h1>
        <p>Control which resources are visible to students and keep the hub organized.</p>
      </div>

      <section className="section-outline">
        <div className="section-outline-header">
          <div>
            <h2>Resources</h2>
            <p>Publish, unpublish, and remove uploaded resources.</p>
          </div>
        </div>

        {error ? <div className="error-msg" style={{ margin: '1rem' }}>{error}</div> : null}
        {loading ? (
          <div className="empty-state"><p>Loading resources...</p></div>
        ) : resources.length === 0 ? (
          <div className="empty-state"><p>No resources created yet.</p></div>
        ) : (
          <div className="panel-table-wrap">
            <table className="panel-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Audience</th>
                  <th>Scope</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {resources.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="table-muted">{new Date(item.created_at).toLocaleDateString('en-GB')}</div>
                    </td>
                    <td>{item.category}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.resource_type}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.audience}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.section_scope}</td>
                    <td>
                      <span className={`badge badge-${item.is_published ? 'approved' : 'pending'}`}>
                        {item.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn-outline" onClick={() => togglePublished(item)}>
                          {item.is_published ? 'Unpublish' : 'Publish'}
                        </button>
                        <button type="button" className="btn-danger-outline" onClick={() => removeResource(item.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
