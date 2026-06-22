export const PLATFORM_NAME = 'HAYRAT Centers';
export const BROTHERS_CENTER_NAME = 'Center of Suffa';
export const SISTERS_CENTER_NAME = 'Center of Azahrah';

export function centerNameForUser(user?: { role?: string; section?: string } | null) {
  if (!user || user.role === 'super_admin') return PLATFORM_NAME;
  if (user.section === 'sisters') return SISTERS_CENTER_NAME;
  return BROTHERS_CENTER_NAME;
}

export function centerBadgeForUser(user?: { role?: string; section?: string } | null) {
  if (!user) return '';
  if (user.role === 'super_admin') return 'Super Admin';
  return centerNameForUser(user);
}
