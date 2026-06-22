const router = require('express').Router();
const { auth } = require('../middleware/auth');
const {
  listMyBooks,
  updateMyBookProgress,
  downloadBook,
} = require('../controllers/bookController');
const {
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
} = require('../services/notificationService');

// Books
router.get('/books', auth, listMyBooks);
router.post('/books/:id/progress', auth, updateMyBookProgress);
router.get('/books/:id/download', auth, downloadBook);

// Notifications
router.get('/notifications', auth, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const notifications = await getUserNotifications(req.user.id, parseInt(limit), parseInt(offset));
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications/unread-count', auth, async (req, res) => {
  try {
    const count = await getUnreadCount(req.user.id);
    res.json({ unread_count: count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/notifications/:id/read', auth, async (req, res) => {
  try {
    const notification = await markNotificationAsRead(req.params.id);
    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/notifications/mark-all-read', auth, async (req, res) => {
  try {
    await markAllAsRead(req.user.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
