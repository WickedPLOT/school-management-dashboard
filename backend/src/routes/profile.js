const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { getProfile, upsertProfile } = require('../controllers/profileController');
const {
  listMyUpdates,
  createMyUpdate,
  listMyIssues,
  createMyIssue,
  listNotifications,
  markNotificationRead,
  listStudentResources,
  getMyReadingProgress,
  updateMyReadingProgress,
} = require('../controllers/phaseTwoController');
const { getMyRoom } = require('../controllers/accommodationController');
const { getMyAttendance, getStudentDashboard } = require('../controllers/eventController');
const { listMyQuranAssignments, listMySchedule, listMyRoutines, listMyMeetings } = require('../controllers/residentLifeController');
const { getStudentFees, initiateFeeStkPush } = require('../controllers/feeController');

const { listMyBooks, updateMyBookProgress } = require('../controllers/bookController');

router.get('/', auth, getProfile);
router.put('/', auth, upsertProfile);
router.get('/updates', auth, listMyUpdates);
router.post('/updates', auth, createMyUpdate);
router.get('/issues', auth, listMyIssues);
router.post('/issues', auth, createMyIssue);
router.get('/notifications', auth, listNotifications);
router.patch('/notifications/:id/read', auth, markNotificationRead);
router.get('/resources', auth, listStudentResources);
router.get('/reading-progress', auth, getMyReadingProgress);
router.put('/reading-progress', auth, updateMyReadingProgress);
router.get('/room', auth, getMyRoom);
router.get('/attendance', auth, getMyAttendance);
router.get('/dashboard', auth, getStudentDashboard);
router.get('/quran-assignments', auth, listMyQuranAssignments);
router.get('/schedule', auth, listMySchedule);
router.get('/routines', auth, listMyRoutines);
router.get('/meetings', auth, listMyMeetings);
router.get('/fees', auth, getStudentFees);
router.post('/fees/:chargeId/stk-push', auth, initiateFeeStkPush);
router.get('/books', auth, listMyBooks);
router.put('/book-progress', auth, updateMyBookProgress);

module.exports = router;
