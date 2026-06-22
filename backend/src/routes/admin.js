const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const { auth, requireRole } = require('../middleware/auth');

// Multer configuration for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});
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
  createDirectMessage,
  listPlatformRecipients,
  sendPlatformMessage,
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
  getStudentMonthlyPerformance,
  reviewStudentUpdate,
  listIssueReports,
  updateIssueReport,
  listResourcesAdmin,
  createResource,
  updateResource,
  deleteResource,
  getAdminReadingProgress,
} = require('../controllers/phaseTwoController');
const {
  listOverview: listAccommodationOverview,
  createBuilding,
  createRoom,
  assignStudent,
  unassignStudent,
  getStudentRoom,
} = require('../controllers/accommodationController');
const {
  listQuranAssignments,
  createQuranAssignment,
  updateQuranAssignment,
  listDailySchedules,
  createDailySchedule,
  updateDailySchedule,
  deleteDailySchedule,
  getDailyScheduleAttendance,
  saveDailyScheduleAttendance,
  getRoutineAttendance,
  saveRoutineAttendance,
  listRoutines,
  createRoutine,
  updateRoutine,
  deleteRoutine,
  listMeetings,
  createMeeting,
  updateMeeting,
} = require('../controllers/residentLifeController');
const {
  listPlans,
  createPlan,
  updatePlan,
  listCharges,
  createCharges,
  recordPayment,
  recordStudentCashPayment,
  getSummary: getFeesSummary,
  getStudentFees,
  initiateFeeStkPush,
} = require('../controllers/feeController');
const { listBooks, createBook, updateBook, deleteBook, getBookStudentProgress, getAllStudentsBookProgress, getStudentBookDetail } = require('../controllers/bookController');
const {
  listDisciplinaryRecords,
  createDisciplinaryRecord,
  updateDisciplinaryRecord,
  deleteDisciplinaryRecord,
} = require('../controllers/disciplinaryController');

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
router.post('/messages/direct',       auth, isAdmin, createDirectMessage);
router.get('/messages/platform/recipients', auth, isAdmin, listPlatformRecipients);
router.post('/messages/platform',     auth, isAdmin, sendPlatformMessage);

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
router.get('/progress/students/:id/monthly',  auth, isAdmin, getStudentMonthlyPerformance);
router.patch('/progress/updates/:id',         auth, isAdmin, reviewStudentUpdate);

// Issues
router.get('/issues/reports',                 auth, isAdmin, listIssueReports);
router.patch('/issues/reports/:id',           auth, isAdmin, updateIssueReport);

// Knowledge hub resources
router.get('/resources',                      auth, isAdmin, listResourcesAdmin);
router.post('/resources',                     auth, isAdmin, createResource);
router.patch('/resources/:id',                auth, isAdmin, updateResource);
router.delete('/resources/:id',               auth, isAdmin, deleteResource);

// Reading progress
router.get('/reading-progress',               auth, isAdmin, getAdminReadingProgress);

// Qur'an duties / schedules / meetings
router.get('/quran/assignments',          auth, isAdmin, listQuranAssignments);
router.post('/quran/assignments',         auth, isAdmin, createQuranAssignment);
router.patch('/quran/assignments/:id',    auth, isAdmin, updateQuranAssignment);
router.get('/daily-schedule',             auth, isAdmin, listDailySchedules);
router.post('/daily-schedule',            auth, isAdmin, createDailySchedule);
router.patch('/daily-schedule/:id',       auth, isAdmin, updateDailySchedule);
router.delete('/daily-schedule/:id',      auth, isAdmin, deleteDailySchedule);
router.get('/daily-schedule/:id/attendance', auth, isAdmin, getDailyScheduleAttendance);
router.put('/daily-schedule/:id/attendance', auth, isAdmin, saveDailyScheduleAttendance);
router.get('/routines',                   auth, isAdmin, listRoutines);
router.post('/routines',                  auth, isAdmin, createRoutine);
router.patch('/routines/:id',             auth, isAdmin, updateRoutine);
router.delete('/routines/:id',            auth, isAdmin, deleteRoutine);
router.get('/routines/:id/attendance',    auth, isAdmin, getRoutineAttendance);
router.put('/routines/:id/attendance',    auth, isAdmin, saveRoutineAttendance);
router.get('/meetings',                   auth, isAdmin, listMeetings);
router.post('/meetings',                  auth, isAdmin, createMeeting);
router.patch('/meetings/:id',             auth, isAdmin, updateMeeting);

// Fees and payments
router.get('/fees/summary',             auth, isAdmin, getFeesSummary);
router.get('/fees/plans',               auth, isAdmin, listPlans);
router.post('/fees/plans',              auth, isAdmin, createPlan);
router.patch('/fees/plans/:id',         auth, isAdmin, updatePlan);
router.get('/fees/charges',             auth, isAdmin, listCharges);
router.post('/fees/charges',            auth, isAdmin, createCharges);
router.post('/fees/payments',           auth, isAdmin, recordPayment);
router.post('/fees/student-payment',    auth, isAdmin, recordStudentCashPayment);
router.post('/fees/charges/:chargeId/stk-push', auth, isAdmin, initiateFeeStkPush);
router.get('/fees/students/:id',        auth, isAdmin, getStudentFees);

// Disciplinary records
router.get('/disciplinary/records',       auth, isAdmin, listDisciplinaryRecords);
router.post('/disciplinary/records',      auth, isAdmin, createDisciplinaryRecord);
router.patch('/disciplinary/records/:id', auth, isAdmin, updateDisciplinaryRecord);
router.delete('/disciplinary/records/:id', auth, isAdmin, deleteDisciplinaryRecord);

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

// Platform books
router.get('/books',              auth, isAdmin, listBooks);
router.post('/books',             auth, isAdmin, upload.single('file'), createBook);
router.patch('/books/:id',        auth, isAdmin, upload.single('file'), updateBook);
router.delete('/books/:id',       auth, isAdmin, deleteBook);
router.get('/books/:id/progress', auth, isAdmin, getBookStudentProgress);
router.get('/students/book-progress', auth, isAdmin, getAllStudentsBookProgress);
router.get('/students/:id/books',     auth, isAdmin, getStudentBookDetail);

module.exports = router;
