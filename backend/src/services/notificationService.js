const pool = require('../config/db');

async function createNotification(userId, { title, message, kind = 'general', actionUrl = null }) {
  try {
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, kind, action_url)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, title, message, kind, actionUrl]
    );
    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [result.insertId]);
    return rows[0];
  } catch (err) {
    console.error('Failed to create notification:', err);
    throw err;
  }
}

async function createBulkNotifications(userIds, { title, message, kind = 'general', actionUrl = null }) {
  if (!userIds || userIds.length === 0) return [];
  try {
    const placeholders = userIds.map(() => '(?, ?, ?, ?, ?)').join(',');
    const values = [];
    userIds.forEach(userId => {
      values.push(userId, title, message, kind, actionUrl);
    });
    const [result] = await pool.query(
      `INSERT INTO notifications (user_id, title, message, kind, action_url)
       VALUES ${placeholders}`,
      values
    );
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE id >= ? ORDER BY id ASC LIMIT ?',
      [result.insertId, result.affectedRows]
    );
    return rows;
  } catch (err) {
    console.error('Failed to create bulk notifications:', err);
    throw err;
  }
}

async function notifyStudentsAboutNewBook(bookTitle, section, bookId, createdByAdmin = true) {
  try {
    const sectionFilter = section === 'all' ? "" : `AND u.section = '${section}'`;

    const [rows] = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       WHERE u.role = 'student'
       AND u.status = 'approved'
       ${sectionFilter}`
    );

    const studentIds = rows.map(r => r.id);

    if (studentIds.length === 0) return [];

    const title = 'New Book Available';
    const message = `A new book "${bookTitle}" has been uploaded to the knowledge hub. Start reading today!`;
    const actionUrl = `/student/library?book=${bookId}`;

    const notifications = await createBulkNotifications(studentIds, {
      title,
      message,
      kind: 'book_upload',
      actionUrl
    });

    return notifications;
  } catch (err) {
    console.error('Failed to notify students about book:', err);
    throw err;
  }
}

async function getUserNotifications(userId, limit = 20, offset = 0) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    return rows;
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    throw err;
  }
}

async function getUnreadCount(userId) {
  try {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );
    return rows[0].count;
  } catch (err) {
    console.error('Failed to get unread count:', err);
    throw err;
  }
}

async function markNotificationAsRead(notificationId) {
  try {
    const [result] = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = ?`,
      [notificationId]
    );
    const [rows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [notificationId]);
    return rows[0];
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    throw err;
  }
}

async function markAllAsRead(userId) {
  try {
    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE user_id = ? AND is_read = FALSE`,
      [userId]
    );
    return true;
  } catch (err) {
    console.error('Failed to mark all notifications as read:', err);
    throw err;
  }
}

module.exports = {
  createNotification,
  createBulkNotifications,
  notifyStudentsAboutNewBook,
  getUserNotifications,
  getUnreadCount,
  markNotificationAsRead,
  markAllAsRead,
};
