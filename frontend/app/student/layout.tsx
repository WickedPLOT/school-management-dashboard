'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { Icons } from '@/lib/icons';
import { STUDENT_NAV } from '@/lib/navConfig';
import { apiFetch } from '@/lib/api';
import { PLATFORM_NAME, centerBadgeForUser } from '@/lib/centers';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [user, setUser] = useState<{ email: string; role: string; section: string } | null>(null);
  const [profileComplete, setProfileComplete] = useState(true); // assume complete until checked

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (!u) { router.push('/login'); return; }
    const parsed = JSON.parse(u);
    if (parsed.role !== 'student') { router.push('/admin/dashboard'); return; }
    setUser(parsed);

    // Check if profile is complete — if not, force to /student/profile
    apiFetch('/profile').then(data => {
      const incomplete = !data || !data.full_name || !data.phone || !data.institution || !data.course;
      setProfileComplete(!incomplete);
      if (incomplete && pathname !== '/student/profile') {
        router.replace('/student/profile');
      }
    }).catch(() => {});
  }, [pathname]);

  if (!user) return null;
  const brandName = PLATFORM_NAME;
  const badge = centerBadgeForUser(user);

  return (
    <div className={`admin-layout ${sidebarCollapsed ? 'sidebar-collapsed-layout' : ''}`}>
      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''} ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* No badge for students — section is private */}
        <Sidebar
          groups={STUDENT_NAV}
          badge={badge}
          email={user.email}
          role="student"
          onNavClick={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          brandName={brandName}
        />
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={() => setSidebarCollapsed((current) => !current)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
      </aside>

      <div className="admin-body">
        {/* Topbar with notifications + announcements */}
        <header className="student-topbar">
          <button className="mobile-menu-btn" onClick={() => setSidebarOpen(o => !o)} style={{ color: 'var(--text)' }}>
            {Icons.menu}
          </button>
          <div className="topbar-actions">
            <Link
              href="/student/announcements"
              className={`topbar-icon-btn ${pathname === '/student/announcements' ? 'active' : ''}`}
              title="Announcements"
            >
              {Icons.announcements}
              <span className="topbar-label">Announcements</span>
            </Link>
            <Link
              href="/student/notifications"
              className={`topbar-icon-btn ${pathname === '/student/notifications' ? 'active' : ''}`}
              title="Notifications"
            >
              {Icons.notifications}
              <span className="notif-dot" />
              <span className="topbar-label">Notifications</span>
            </Link>
          </div>
        </header>

        {/* Incomplete profile banner */}
        {!profileComplete && pathname !== '/student/profile' && (
          <div style={{
            background: '#fef3c7', borderBottom: '1px solid #fde68a',
            padding: '0.625rem 1.5rem', fontSize: '0.825rem', color: '#92400e',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
          }}>
            <span>Your profile is incomplete. Please complete it to access all features.</span>
            <Link href="/student/profile" style={{ fontWeight: 700, color: '#92400e', textDecoration: 'underline', whiteSpace: 'nowrap' }}>
              Complete Profile
            </Link>
          </div>
        )}

        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}
