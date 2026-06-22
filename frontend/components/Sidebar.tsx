'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { Icons } from '@/lib/icons';
import type { NavGroup } from '@/lib/navConfig';

type Props = {
  groups: NavGroup[];
  badge?: string;
  email?: string;
  role?: string;
  onNavClick?: () => void;
  collapsed?: boolean;
  brandName?: string;
};

export default function Sidebar({ groups, badge, email, role, onNavClick, collapsed = false, brandName = 'HAYRAT Centers' }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const titledGroupKeys = useMemo(
    () => groups.filter((group) => group.title).map((group) => group.title as string),
    [groups]
  );
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      titledGroupKeys.map((title) => [
        title,
        groups.some((group) => group.title === title && group.items.some((item) => pathname.startsWith(item.href))),
      ])
    )
  );

  useEffect(() => {
    setOpenGroups((current) =>
      Object.fromEntries(
        titledGroupKeys.map((title) => [
          title,
          current[title] || groups.some((group) => group.title === title && group.items.some((item) => pathname.startsWith(item.href))),
        ])
      )
    );
  }, [groups, pathname, titledGroupKeys]);

  function logout() {
    localStorage.clear();
    router.push('/login');
  }

  function toggleGroup(title: string) {
    setOpenGroups((current) => ({ ...current, [title]: !current[title] }));
  }

  const roleLabel = role === 'student' ? 'Student Portal' : 'Admin Panel';

  return (
    <>
      <div className="sidebar-brand">
        <div className="brand-icon">{Icons.logo}</div>
        <div>
          {!collapsed ? (<>
            <h2>{brandName}</h2>
            <span>{roleLabel}</span>
          </>) : null}
        </div>
      </div>

      {badge && !collapsed ? <div className="sidebar-section-badge">{badge}</div> : null}

      <nav className="sidebar-nav">
        {groups.map((group, gi) => (
          <div key={gi} className="nav-group">
            {group.title ? (
              <>
                <button
                  type="button"
                  className={`nav-group-toggle ${group.items.some((item) => pathname.startsWith(item.href)) ? 'active' : ''}`}
                  onClick={() => toggleGroup(group.title as string)}
                >
                  <span className="nav-group-toggle-left">
                    {group.items[0]?.icon}
                    {!collapsed ? <span>{group.title}</span> : null}
                  </span>
                  {!collapsed ? <svg
                    className={`nav-group-chevron ${openGroups[group.title] ? 'open' : ''}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg> : null}
                </button>
                {!collapsed && openGroups[group.title] && (
                  <div className="nav-group-children">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavClick}
                        className={`nav-item nav-child-item ${pathname === item.href ? 'active' : ''}`}
                      >
                        {item.icon}
                        {!collapsed ? <span>{item.label}</span> : null}
                      </Link>
                    ))}
                  </div>
                )}
              </>
            ) : (
              group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  className={`nav-item ${pathname === item.href ? 'active' : ''}`}
                >
                  {item.icon}
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              ))
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {email && !collapsed ? <p className="sidebar-email">{email}</p> : null}
        <button onClick={logout} className="nav-item nav-item-logout">
          {Icons.logout}
          {!collapsed ? <span>Logout</span> : null}
        </button>
      </div>
    </>
  );
}
