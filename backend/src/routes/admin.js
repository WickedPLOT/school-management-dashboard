const router = require('express').Router();
const { auth, requireRole } = require('../middleware/auth');
const {
  getPendingUsers, getAllStudents, getRejectedStudents,
  approveUser, rejectUser,
  searchProfiles, getIncompleteProfiles, getStudentProfile,
  getDashboardStats,
  getAdmins, createAdmin, updateAdmin, deleteAdmin,
  addNote, getNotes,
} = require('../controllers/adminController');
const {
  getSettings,
  saveSettings,
  getMessagingSummary,
  getHistory,
  createBroadcast,
} = require('../controllers/messageController');
const {
  getSettings: getAppSettings,
  saveSettings: saveAppSettings,
  getPublic: getPublicSettings,
} = require('../controllers/settingsController');
const { generateSingleInvite, generateInvite, listInvites } = require('../controllers/inviteController');
const {
  listEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventRoster,
  saveEventAttendance,
  getAttendanceSummary,
  getAttendanceOverview,
} = require('../controllers/eventController');
const {
  listStudentUpdates,
  reviewStudentUpdate,
  listIssueReports,
  updateIssueReport,
  listResourcesAdmin,
  createResource,
  updateResource,
  deleteResource,
} = require('../controllers/phaseTwoController');
const {
  listOverview: listAccommodationOverview,
  createBuilding,
  createRoom,
  assignStudent,
  unassignStudent,
  getStudentRoom,
} = require('../controllers/accommodationController');

const isAdmin      = requireRole('brothers_admin', 'sisters_admin', 'super_admin');
const isSuperAdmin = requireRole('super_admin');

// Dashboard
router.get('/dashboard',              auth, isAdmin, getDashboardStats);

// Student accounts
router.get('/pending-users',          auth, isAdmin, getPendingUsers);
router.get('/students',               auth, isAdmin, getAllStudents);
router.get('/students/rejected',      auth, isAdmin, getRejectedStudents);
router.patch('/approve/:id',          auth, isAdmin, approveUser);
router.patch('/reject/:id',           auth, isAdmin, rejectUser);

// Profiles
router.get('/profiles',               auth, isAdmin, searchProfiles);
router.get('/profiles/incomplete',    auth, isAdmin, getIncompleteProfiles);
router.get('/profiles/:id',           auth, isAdmin, getStudentProfile);

// Invites
router.post('/invite/single',         auth, isAdmin, generateSingleInvite);
router.post('/invite',                auth, isAdmin, generateInvite);
router.get('/invites',                auth, isAdmin, listInvites);

// Notes
router.post('/notes/:id',             auth, isAdmin, addNote);
router.get('/notes/:id',              auth, isAdmin, getNotes);

// Messaging / communications
router.get('/messages/settings',      auth, isAdmin, getSettings);
router.put('/messages/settings',      auth, isAdmin, saveSettings);
router.get('/messages/summary',       auth, isAdmin, getMessagingSummary);
router.get('/messages/history',       auth, isAdmin, getHistory);
router.post('/messages/broadcast',    auth, isAdmin, createBroadcast);

// General settings
router.get('/settings',               auth, isAdmin, getAppSettings);
router.put('/settings',               auth, isAdmin, saveAppSettings);
router.get('/settings/public',        getPublicSettings);

// Attendance / events
router.get('/attendance/events',              auth, isAdmin, listEvents);
router.post('/attendance/events',             auth, isAdmin, createEvent);
router.patch('/attendance/events/:id',        auth, isAdmin, updateEvent);
router.delete('/attendance/events/:id',       auth, isAdmin, deleteEvent);
router.get('/attendance/events/:id',          auth, isAdmin, getEventRoster);
router.put('/attendance/events/:id',          auth, isAdmin, saveEventAttendance);
router.get('/attendance/overview',            auth, isAdmin, getAttendanceOverview);
router.get('/attendance/students/:id/summary', auth, isAdmin, getAttendanceSummary);

// Progress / activity updates
router.get('/progress/updates',               auth, isAdmin, listStudentUpdates);
router.patch('/progress/updates/:id',         auth, isAdmin, reviewStudentUpdate);

// Issues
router.get('/issues/reports',                 auth, isAdmin, listIssueReports);
router.patch('/issues/reports/:id',           auth, isAdmin, updateIssueReport);

// Knowledge hub resources
router.get('/resources',                      auth, isAdmin, listResourcesAdmin);
router.post('/resources',                     auth, isAdmin, createResource);
router.patch('/resources/:id',                auth, isAdmin, updateResource);
router.delete('/resources/:id',               auth, isAdmin, deleteResource);

// Accommodation
router.get('/accommodation/overview',         auth, isAdmin, listAccommodationOverview);
router.post('/accommodation/buildings',       auth, isAdmin, createBuilding);
router.post('/accommodation/rooms',           auth, isAdmin, createRoom);
router.post('/accommodation/assignments',     auth, isAdmin, assignStudent);
router.delete('/accommodation/assignments/:user_id', auth, isAdmin, unassignStudent);
router.get('/accommodation/students/:id',     auth, isAdmin, getStudentRoom);

// Super admin — manage section admins
router.get('/admins',                 auth, isSuperAdmin, getAdmins);
router.post('/admins',                auth, isSuperAdmin, createAdmin);
router.patch('/admins/:id',           auth, isSuperAdmin, updateAdmin);
router.delete('/admins/:id',          auth, isSuperAdmin, deleteAdmin);

module.exports = router;
