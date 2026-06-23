export const PLATFORM_NAME = 'HAYRAT CENTER';
export const BROTHERS_CENTER_NAME = 'Centre of Suffa';
export const SISTERS_CENTER_NAME = 'Centre of Azzarah';

export function centerNameForSection(section?: string) {
  if (section === 'sisters') return SISTERS_CENTER_NAME;
  if (section === 'brothers') return BROTHERS_CENTER_NAME;
  return PLATFORM_NAME;
}

export function centerNameForUser(user?: { role?: string; section?: string } | null) {
  if (!user || user.role === 'super_admin') return PLATFORM_NAME;
  return centerNameForSection(user.section);
}

export function centerBadgeForUser(user?: { role?: string; section?: string } | null) {
  if (!user) return '';
  if (user.role === 'super_admin') return 'Super Admin';
  return centerNameForUser(user);
}
