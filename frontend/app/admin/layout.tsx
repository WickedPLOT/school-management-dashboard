'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { Icons } from '@/lib/icons';
import { ADMIN_NAV, SUPER_ADMIN_NAV } from '@/lib/navConfig';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string; section: string } | null>(null);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    setUser(JSON.parse(u));
  }, []);

  if (!user) return null;

  const isSuperAdmin = user.role === 'super_admin';
  const navGroups = isSuperAdmin ? SUPER_ADMIN_NAV : ADMIN_NAV;
  const badge = isSuperAdmin
    ? 'Super Admin'
    : user.section === 'brothers' ? 'Brothers Section' : 'Sisters Section';

  return (
    <div className="admin-layout">
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`}>
        <Sidebar
          groups={navGroups}
          badge={badge}
          email={user.email}
          role={user.role}
          onNavClick={() => setSidebarOpen(false)}
        />
      </aside>

      <div className="admin-body">
        <header className="mobile-header">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)}>
            {sidebarOpen ? Icons.close : Icons.menu}
          </button>
          <span className="mobile-brand">Hayrat Centre</span>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
