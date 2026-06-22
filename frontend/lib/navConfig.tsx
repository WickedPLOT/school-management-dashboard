import { Icons } from './icons';
import { BROTHERS_CENTER_NAME, SISTERS_CENTER_NAME } from './centers';

export type NavItem = { href: string; label: string; icon: React.ReactNode; };
export type NavGroup = { title?: string; items: NavItem[]; };

export const STUDENT_NAV: NavGroup[] = [
  {
    items: [
      { href: '/student/dashboard',  label: 'Dashboard',                icon: Icons.dashboard },
      { href: '/student/profile',    label: 'My Profile',               icon: Icons.profile },
      { href: '/student/library',    label: 'Knowledge Hub',            icon: Icons.library },
      { href: '/student/progress',   label: 'Progress & Book Tracking', icon: Icons.progress },
      { href: '/student/room',       label: 'My Room / Accommodation',  icon: Icons.room },
      { href: '/student/fees',       label: 'My Fees / Payments',       icon: Icons.analytics },
      { href: '/student/issues',     label: 'Report an Issue',          icon: Icons.issues },
      { href: '/student/attendance', label: 'Attendance',               icon: Icons.attendance },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    title: 'Dashboard',
    items: [
      { href: '/admin/dashboard',     label: 'Dashboard',     icon: Icons.dashboard },
      { href: '/admin/registrations', label: 'Registrations', icon: Icons.students },
    ],
  },
  {
    title: 'Student Profiles',
    items: [
      { href: '/admin/students/pending',    label: 'Pending Approvals',   icon: Icons.students },
      { href: '/admin/students/all',        label: 'All Students',        icon: Icons.students },
      { href: '/admin/students/rejected',   label: 'Rejected Accounts',   icon: Icons.students },
      { href: '/admin/profiles/incomplete', label: 'Incomplete Profiles', icon: Icons.profile },
    ],
  },
  {
    title: 'Knowledge Hub',
    items: [
      { href: '/admin/announcements', label: 'Daily Activities',  icon: Icons.announcements },
      { href: '/admin/quran',         label: "Qur'an Duties",     icon: Icons.quran },
      { href: '/admin/routines',      label: 'Routine Programs',  icon: Icons.announcements },
      { href: '/admin/resources/events', label: 'Events Calendar', icon: Icons.library },
      { href: '/admin/library/upload',   label: 'Upload Materials', icon: Icons.library },
      { href: '/admin/library/manage',   label: 'Manage Files',    icon: Icons.library },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { href: '/admin/attendance/mark',    label: 'Attendance Register', icon: Icons.attendance },
      { href: '/admin/attendance/records', label: 'Attendance Summary',  icon: Icons.attendance },
    ],
  },
  {
    title: 'Progress Tracking',
    items: [
      { href: '/admin/progress/quran',    label: "Qur'anic Progress", icon: Icons.quran },
      { href: '/admin/progress/academic', label: 'Academic Activity',  icon: Icons.progress },
      { href: '/admin/progress/books',    label: 'Books Management',   icon: Icons.library },
      { href: '/admin/progress/reading',  label: 'Reading Progress',   icon: Icons.library },
    ],
  },
  {
    title: 'Accommodation',
    items: [
      { href: '/admin/accommodation/rooms',     label: 'Dormitories & Rooms', icon: Icons.dormitory },
      { href: '/admin/accommodation/assign',    label: 'Room Assignments',    icon: Icons.dormitory },
      { href: '/admin/accommodation/occupancy', label: 'Occupancy Overview',  icon: Icons.dormitory },
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
    title: 'Messages',
    items: [
      { href: '/admin/messages',          label: 'Messaging Settings',        icon: Icons.messages },
      { href: '/admin/messages/platform', label: 'Platform Messages',         icon: Icons.messages },
      { href: '/admin/notifications',     label: 'Platform Inbox',            icon: Icons.notifications },
      { href: '/admin/messages/students', label: 'Message Students',          icon: Icons.messages },
      { href: '/admin/messages/parents',  label: 'Message Parents/Guardians', icon: Icons.messages },
    ],
  },
  {
    items: [
      { href: '/admin/fees',         label: 'Fees & Payments',      icon: Icons.analytics },
      { href: '/admin/disciplinary', label: 'Disciplinary Records', icon: Icons.disciplinary },
      { href: '/admin/settings',     label: 'Settings',             icon: Icons.settings },
    ],
  },
];

export const SUPER_ADMIN_NAV: NavGroup[] = [
  {
    title: 'Dashboard',
    items: [
      { href: '/admin/dashboard',     label: 'Dashboard',     icon: Icons.dashboard },
      { href: '/admin/registrations', label: 'Registrations', icon: Icons.students },
    ],
  },
  {
    title: 'Student Profiles',
    items: [
      { href: '/admin/students/all',        label: 'All Students',        icon: Icons.students },
      { href: '/admin/students/pending',    label: 'Pending Approvals',   icon: Icons.students },
      { href: '/admin/students/rejected',   label: 'Rejected Accounts',   icon: Icons.students },
      { href: '/admin/students/brothers',   label: BROTHERS_CENTER_NAME,  icon: Icons.students },
      { href: '/admin/students/sisters',    label: SISTERS_CENTER_NAME,   icon: Icons.students },
      { href: '/admin/profiles/incomplete', label: 'Incomplete Profiles', icon: Icons.profile },
    ],
  },
  {
    title: 'Knowledge Hub',
    items: [
      { href: '/admin/announcements', label: 'Daily Activities',  icon: Icons.announcements },
      { href: '/admin/quran',         label: "Qur'an Duties",     icon: Icons.quran },
      { href: '/admin/routines',      label: 'Routine Programs',  icon: Icons.announcements },
      { href: '/admin/resources/events', label: 'Events Calendar', icon: Icons.library },
      { href: '/admin/library/upload',   label: 'Upload Materials', icon: Icons.library },
      { href: '/admin/library/manage',   label: 'Manage Files',    icon: Icons.library },
    ],
  },
  {
    title: 'Attendance',
    items: [
      { href: '/admin/attendance/mark',    label: 'Attendance Register', icon: Icons.attendance },
      { href: '/admin/attendance/records', label: 'Attendance Summary',  icon: Icons.attendance },
    ],
  },
  {
    title: 'Progress Tracking',
    items: [
      { href: '/admin/progress/quran',    label: "Qur'anic Progress", icon: Icons.quran },
      { href: '/admin/progress/academic', label: 'Academic Activity',  icon: Icons.progress },
      { href: '/admin/progress/books',    label: 'Books Management',   icon: Icons.library },
      { href: '/admin/progress/reading',  label: 'Reading Progress',   icon: Icons.library },
    ],
  },
  {
    title: 'Accommodation',
    items: [
      { href: '/admin/accommodation/occupancy', label: 'Accommodation Overview', icon: Icons.dormitory },
      { href: '/admin/accommodation/rooms',     label: 'Dormitories & Rooms',    icon: Icons.dormitory },
      { href: '/admin/accommodation/assign',    label: 'Room Assignments',       icon: Icons.dormitory },
    ],
  },
  {
    title: 'Issue Reports & Messages',
    items: [
      { href: '/admin/issues/pending',     label: 'Issue Reports',         icon: Icons.issues },
      { href: '/admin/messages',           label: 'Messaging Settings',    icon: Icons.messages },
      { href: '/admin/messages/platform',  label: 'Platform Messages',     icon: Icons.messages },
      { href: '/admin/notifications',      label: 'Platform Inbox',        icon: Icons.notifications },
      { href: '/admin/messages/students',  label: 'Messages',              icon: Icons.messages },
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
      { href: '/admin/fees',         label: 'Fees & Payments',      icon: Icons.analytics },
      { href: '/admin/disciplinary', label: 'Disciplinary Records', icon: Icons.disciplinary },
      { href: '/admin/settings',     label: 'Settings',             icon: Icons.settings },
    ],
  },
];
