const MOCK_USERS: Record<string, { token: string; user: { id: number; email: string; role: string; section: string } }> = {
  'superadmin@hayrat.com': {
    token: 'mock-token',
    user: { id: 0, email: 'superadmin@hayrat.com', role: 'super_admin', section: 'brothers' },
  },
  'brothers.admin@hayrat.com': {
    token: 'mock-token',
    user: { id: 1, email: 'brothers.admin@hayrat.com', role: 'brothers_admin', section: 'brothers' },
  },
  'sisters.admin@hayrat.com': {
    token: 'mock-token',
    user: { id: 2, email: 'sisters.admin@hayrat.com', role: 'sisters_admin', section: 'sisters' },
  },
  'student@hayrat.com': {
    token: 'mock-token',
    user: { id: 3, email: 'student@hayrat.com', role: 'student', section: 'brothers' },
  },
};

const MOCK_PASSWORDS: Record<string, string> = {
  'superadmin@hayrat.com': 'superadmin123',
  'brothers.admin@hayrat.com': 'admin123',
  'sisters.admin@hayrat.com': 'admin123',
  'student@hayrat.com': 'student123',
};

export function mockLogin(email: string, password: string) {
  const entry = MOCK_USERS[email];
  if (entry && MOCK_PASSWORDS[email] === password) return entry;
  return null;
}

export const MOCK_PENDING_USERS = [
  { id: 10, email: 'ali.hassan@gmail.com',    section: 'brothers', status: 'pending', created_at: new Date().toISOString() },
  { id: 11, email: 'omar.salim@gmail.com',     section: 'brothers', status: 'pending', created_at: new Date().toISOString() },
  { id: 12, email: 'fatuma.said@gmail.com',    section: 'sisters',  status: 'pending', created_at: new Date().toISOString() },
];

export const MOCK_PROFILE = {
  full_name: 'Ahmed Hassan', phone: '0712345678', gender: 'male',
  institution: 'University of Nairobi', course: 'Computer Science',
  year_of_study: 2, quran_level: 'Juz 10', home_county: 'Nairobi',
};
