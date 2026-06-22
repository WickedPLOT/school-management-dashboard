const pool = require('../config/db');

/**
 * Create notification for a user
 */
async function createNotification(userId, { title, message, kind = 'general', actionUrl = null }) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, kind, action_url)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, title, message, kind, actionUrl]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Failed to create notification:', err);
    throw err;
  }
}

/**
 * Create notifications for multiple users
 */
async function createBulkNotifications(userIds, { title, message, kind = 'general', actionUrl = null }) {
  if (!userIds || userIds.length === 0) return [];
  try {
    const placeholders = userIds.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4}, $${i * 4 + 5})`).join(',');
    const values = [];
    userIds.forEach(userId => {
      values.push(userId, title, message, kind, actionUrl);
    });
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, kind, action_url)
       VALUES ${placeholders}
       RETURNING *`,
      values
    );
    return result.rows;
  } catch (err) {
    console.error('Failed to create bulk notifications:', err);
    throw err;
  }
}

/**
 * Notify all students in a section about a new book
 */
async function notifyStudentsAboutNewBook(bookTitle, section, bookId, createdByAdmin = true) {
  try {
    const sectionFilter = section === 'all' ? "" : `AND u.section = '${section}'`;
    
    // Get all eligible students
    const studentsResult = await pool.query(
      `SELECT DISTINCT u.id FROM users u
       WHERE u.role = 'student' 
       AND u.status = 'approved'
       ${sectionFilter}`
    );

    const studentIds = studentsResult.rows.map(r => r.id);
    
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

/**
 * Get user notifications (paginated)
 */
async function getUserNotifications(userId, limit = 20, offset = 0) {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );
    return result.rows;
  } catch (err) {
    console.error('Failed to fetch notifications:', err);
    throw err;
  }
}

/**
 * Get unread notification count
 */
async function getUnreadCount(userId) {
  try {
    const result = await pool.query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );
    return result.rows[0].count;
  } catch (err) {
    console.error('Failed to get unread count:', err);
    throw err;
  }
}

/**
 * Mark notification as read
 */
async function markNotificationAsRead(notificationId) {
  try {
    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [notificationId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Failed to mark notification as read:', err);
    throw err;
  }
}

/**
 * Mark all notifications as read for a user
 */
async function markAllAsRead(userId) {
  try {
    await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
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
