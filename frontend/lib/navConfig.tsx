import { Icons } from './icons';

export type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
};

export type NavGroup = {
  title?: string;
  items: NavItem[];
};

export const STUDENT_NAV: NavGroup[] = [
  {
    items: [
      { href: '/student/dashboard',  label: 'Dashboard',                      icon: Icons.dashboard },
      { href: '/student/profile',    label: 'My Profile',                     icon: Icons.profile },
      { href: '/student/room',       label: 'My Room / Accommodation',        icon: Icons.room },
      { href: '/student/progress',   label: "Academic & Qur'anic Progress",   icon: Icons.progress },
      { href: '/student/issues',     label: 'Report an Issue',                icon: Icons.issues },
      { href: '/student/messages',   label: 'Messages',                       icon: Icons.messages },
      { href: '/student/library',    label: 'Knowledge Hub',                  icon: Icons.library },
      { href: '/student/attendance', label: 'Attendance',                     icon: Icons.attendance },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: Icons.dashboard },
    ],
  },
  {
    title: 'Student Accounts',
    items: [
      { href: '/admin/registrations',      label: 'Registrations',      icon: Icons.students },
      { href: '/admin/students/pending',   label: 'Pending Approvals',  icon: Icons.students },
      { href: '/admin/students/all',       label: 'All Students',       icon: Icons.students },
      { href: '/admin/students/rejected',  label: 'Rejected Accounts',  icon: Icons.students },
    ],
  },
  {
    title: 'Student Profiles',
    items: [
      { href: '/admin/profiles/search',      label: 'View / Search Profiles', icon: Icons.profile },
      { href: '/admin/profiles/incomplete',  label: 'Incomplete Profiles',    icon: Icons.profile },
    ],
  },  {
    title: 'Accommodation',
    items: [
      { href: '/admin/accommodation/rooms',     label: 'Dormitories & Rooms',  icon: Icons.dormitory },
      { href: '/admin/accommodation/assign',    label: 'Room Assignments',      icon: Icons.dormitory },
      { href: '/admin/accommodation/occupancy', label: 'Occupancy Overview',    icon: Icons.dormitory },
    ],
  },
  {
    title: 'Progress Tracking',
    items: [
      { href: '/admin/progress/quran',    label: "Qur'anic Progress",  icon: Icons.quran },
      { href: '/admin/progress/academic', label: 'Academic Activity',  icon: Icons.progress },
    ],
  },
  {
    title: 'Issue Reports',
    items: [
      { href: '/admin/issues/pending',    label: 'Pending Issues',  icon: Icons.issues },
      { href: '/admin/issues/inprogress', label: 'In Progress',     icon: Icons.issues },
      { href: '/admin/issues/resolved',   label: 'Resolved Issues', icon: Icons.issues },
    ],
  },
  {
    items: [
      { href: '/admin/announcements', label: 'Announcements', icon: Icons.announcements },
    ],
  },
  {
    title: 'Messages',
    items: [
      { href: '/admin/messages/students', label: 'Message Students',          icon: Icons.messages },
      { href: '/admin/messages/parents',  label: 'Message Parents/Guardians', icon: Icons.messages },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { href: '/admin/attendance/mark',    label: 'Attendance Register', icon: Icons.attendance },
      { href: '/admin/attendance/records', label: 'Attendance Summary', icon: Icons.attendance },
    ],
  },
  {
    title: 'Knowledge Hub',
    items: [
      { href: '/admin/resources/events', label: 'Events Calendar',  icon: Icons.library },
      { href: '/admin/library/upload', label: 'Upload Materials', icon: Icons.library },
      { href: '/admin/library/manage', label: 'Manage Files',     icon: Icons.library },
    ],
  },
  {
    items: [
      { href: '/admin/disciplinary', label: 'Disciplinary Records', icon: Icons.disciplinary },
      { href: '/admin/analytics',    label: 'Reports & Analytics',  icon: Icons.analytics },
      { href: '/admin/settings',     label: 'Settings',             icon: Icons.settings },
    ],
  },
];

export const SUPER_ADMIN_NAV: NavGroup[] = [
  {
    items: [
      { href: '/admin/dashboard', label: 'Dashboard (Both Sections)', icon: Icons.dashboard },
    ],
  },
  {
    title: 'All Accounts',
    items: [
      { href: '/admin/students/brothers', label: 'Brothers Section', icon: Icons.students },
      { href: '/admin/students/sisters',  label: 'Sisters Section',  icon: Icons.students },
    ],
  },
  {
    items: [
      { href: '/admin/accommodation/occupancy', label: 'Accommodation',    icon: Icons.dormitory },
      { href: '/admin/progress/quran',          label: 'Progress Tracking', icon: Icons.progress },
      { href: '/admin/issues/pending',          label: 'Issue Reports',     icon: Icons.issues },
      { href: '/admin/announcements',           label: 'Announcements',     icon: Icons.announcements },
      { href: '/admin/messages/students',       label: 'Messages',          icon: Icons.messages },
      { href: '/admin/attendance/records',      label: 'Attendance',        icon: Icons.attendance },
      { href: '/admin/resources/events',        label: 'Knowledge Hub',     icon: Icons.library },
      { href: '/admin/disciplinary',            label: 'Disciplinary Records', icon: Icons.disciplinary },
    ],
  },
  {
    title: 'Reports & Analytics',
    items: [
      { href: '/admin/analytics/engagement', label: 'Engagement Trends',      icon: Icons.analytics },
      { href: '/admin/analytics/occupancy',  label: 'Room Occupancy Stats',   icon: Icons.analytics },
      { href: '/admin/analytics/issues',     label: 'Issue Resolution Rates', icon: Icons.analytics },
    ],
  },
  {
    title: 'Admin Management',
    items: [
      { href: '/admin/admins', label: 'Manage Admins', icon: Icons.adminMgmt },
    ],
  },
  {
    items: [
      { href: '/admin/settings', label: 'Settings', icon: Icons.settings },
    ],
  },
];
