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
} = require('../controllers/phaseTwoController');
const { getMyRoom } = require('../controllers/accommodationController');

router.get('/', auth, getProfile);
router.put('/', auth, upsertProfile);
router.get('/updates', auth, listMyUpdates);
router.post('/updates', auth, createMyUpdate);
router.get('/issues', auth, listMyIssues);
router.post('/issues', auth, createMyIssue);
router.get('/notifications', auth, listNotifications);
router.patch('/notifications/:id/read', auth, markNotificationRead);
router.get('/resources', auth, listStudentResources);
router.get('/room', auth, getMyRoom);

module.exports = router;
