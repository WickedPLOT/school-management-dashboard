const pool = require('../config/db');

function adminSectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = ?`, params: [req.user.section] };
}

async function createNotification(client, userId, title, message, kind = 'general', actionUrl = null) {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, kind, action_url)
     VALUES (?,?,?,?,?)`,
    [userId, title, message, kind, actionUrl]
  );
}

async function listStudentUpdates(req, res) {
  const { track = 'all' } = req.query;
  const { clause, params } = adminSectionFilter(req);
  const filters = [...params];
  let trackClause = '';
  if (track !== 'all') {
    filters.push(track);
    trackClause = ' AND su.track = ?';
  }

  try {
    const [rows] = await pool.query(
      `SELECT su.*, u.email, u.section, p.full_name, p.institution, p.course,
              reviewer.email AS reviewed_by_email
       FROM student_updates su
       JOIN users u ON u.id = su.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users reviewer ON reviewer.id = su.reviewed_by
       WHERE u.role='student'${clause}${trackClause}
       ORDER BY su.created_at DESC`,
      filters
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getStudentMonthlyPerformance(req, res) {
  const { id } = req.params;
  try {
    const [studentRows] = await pool.query(
      `SELECT id, section FROM users WHERE id=? AND role='student'`,
      [id]
    );
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found' });
    if (req.user.role !== 'super_admin' && studentRows[0].section !== req.user.section) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [rows] = await pool.query(
      `WITH RECURSIVE months AS (
         SELECT DATE_FORMAT(CURRENT_DATE, '%Y-%m-01') AS month_start
         UNION ALL
         SELECT DATE_SUB(month_start, INTERVAL 1 MONTH)
         FROM months
         WHERE month_start > DATE_FORMAT(CURRENT_DATE - INTERVAL 5 MONTH, '%Y-%m-01')
       ), tracks AS (
         SELECT 'academic' AS track
         UNION ALL
         SELECT 'religious'
         UNION ALL
         SELECT 'activity'
       ), scores AS (
         SELECT DATE_FORMAT(created_at, '%Y-%m-01') AS month_start,
                track,
                ROUND(AVG(COALESCE(progress_score, 0)), 1) AS score,
                COUNT(*) AS update_count
         FROM student_updates
         WHERE user_id = ?
           AND track IN ('academic','religious','activity')
           AND created_at >= DATE_FORMAT(CURRENT_DATE - INTERVAL 5 MONTH, '%Y-%m-01')
         GROUP BY DATE_FORMAT(created_at, '%Y-%m-01'), track
       )
       SELECT DATE_FORMAT(m.month_start, '%b %Y') AS month_label,
              DATE_FORMAT(m.month_start, '%Y-%m') AS month_key,
              t.track,
              COALESCE(s.score, 0) AS score,
              COALESCE(s.update_count, 0) AS update_count
       FROM months m
       CROSS JOIN tracks t
       LEFT JOIN scores s ON s.month_start = m.month_start AND s.track = t.track
       ORDER BY m.month_start ASC, t.track ASC`,
      [id]
    );

    const months = [];
    const monthMap = new Map();
    for (const row of rows) {
      if (!monthMap.has(row.month_key)) {
        const month = { month: row.month_key, label: row.month_label, academic: 0, religious: 0, activity: 0, counts: { academic: 0, religious: 0, activity: 0 } };
        monthMap.set(row.month_key, month);
        months.push(month);
      }
      const month = monthMap.get(row.month_key);
      month[row.track] = Number(row.score || 0);
      month.counts[row.track] = Number(row.update_count || 0);
    }

    res.json({ months });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function reviewStudentUpdate(req, res) {
  const { id } = req.params;
  const { admin_note, progress_score, review_status = 'reviewed' } = req.body;
  if (!['submitted', 'reviewed'].includes(review_status)) {
    return res.status(400).json({ error: 'Invalid review status' });
  }

  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const reviewedAt = review_status === 'reviewed' ? new Date() : null;
    const [existingRows] = await client.query(
      `SELECT su.id, su.user_id, su.title, u.section
       FROM student_updates su
       JOIN users u ON u.id = su.user_id
       WHERE su.id = ?`,
      [id]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Update not found' });
    }
    if (req.user.role !== 'super_admin' && existingRows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await client.query(
      `UPDATE student_updates
       SET admin_note = ?,
           progress_score = ?,
           review_status = ?,
           reviewed_by = ?,
           reviewed_at = ?
       WHERE id = ?`,
      [admin_note?.trim() || null, progress_score ?? null, review_status, req.user.id, reviewedAt, id]
    );

    const [updatedRows] = await client.query(
      `SELECT * FROM student_updates WHERE id = ?`,
      [id]
    );

    await createNotification(
      client,
      existingRows[0].user_id,
      'Progress update reviewed',
      `Your update "${existingRows[0].title}" was reviewed by an administrator.`,
      'progress',
      '/student/progress'
    );

    await client.query('COMMIT');
    res.json(updatedRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listMyUpdates(req, res) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  try {
    const [rows] = await pool.query(
      `SELECT * FROM student_updates
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createMyUpdate(req, res) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { track, title, summary, details, progress_score } = req.body;
  if (!['academic', 'religious', 'activity'].includes(track)) {
    return res.status(400).json({ error: 'Invalid track' });
  }
  if (!title?.trim() || !summary?.trim()) {
    return res.status(400).json({ error: 'Title and summary are required' });
  }

  try {
    const [insertResult] = await pool.query(
      `INSERT INTO student_updates (user_id, track, title, summary, details, progress_score)
       VALUES (?,?,?,?,?,?)`,
      [req.user.id, track, title.trim(), summary.trim(), details?.trim() || null, progress_score || null]
    );
    const [rows] = await pool.query(
      `SELECT * FROM student_updates WHERE id = ?`,
      [insertResult.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listIssueReports(req, res) {
  const { status = 'all' } = req.query;
  const { clause, params } = adminSectionFilter(req);
  const filters = [...params];
  let statusClause = '';
  if (status !== 'all') {
    filters.push(status);
    statusClause = ' AND i.status = ?';
  }

  try {
    const [rows] = await pool.query(
      `SELECT i.*, u.email, u.section, p.full_name, p.phone, assignee.email AS assigned_to_email
       FROM issue_reports i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users assignee ON assignee.id = i.assigned_to
       WHERE u.role='student'${clause}${statusClause}
       ORDER BY i.updated_at DESC, i.created_at DESC`,
      filters
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateIssueReport(req, res) {
  const { id } = req.params;
  const { status, admin_note } = req.body;
  if (!['pending', 'inprogress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [existingRows] = await client.query(
      `SELECT i.id, i.user_id, i.title, u.section
       FROM issue_reports i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = ?`,
      [id]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found' });
    }
    if (req.user.role !== 'super_admin' && existingRows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    await client.query(
      `UPDATE issue_reports
       SET status = ?,
           admin_note = ?,
           assigned_to = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [status, admin_note?.trim() || null, req.user.id, id]
    );

    const [updatedRows] = await client.query(
      `SELECT * FROM issue_reports WHERE id = ?`,
      [id]
    );

    await createNotification(
      client,
      existingRows[0].user_id,
      'Issue update',
      `Your issue "${existingRows[0].title}" is now marked as ${status}.`,
      'issue',
      '/student/issues'
    );

    await client.query('COMMIT');
    res.json(updatedRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listMyIssues(req, res) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM issue_reports
       WHERE user_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createMyIssue(req, res) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { title, category, location, description, attachment_name, attachment_data } = req.body;
  if (!title?.trim() || !category?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'Title, category, and description are required' });
  }

  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [insertResult] = await client.query(
      `INSERT INTO issue_reports (user_id, title, category, location, description, attachment_name, attachment_data)
       VALUES (?,?,?,?,?,?,?)`,
      [
        req.user.id,
        title.trim(),
        category.trim(),
        location?.trim() || null,
        description.trim(),
        attachment_name?.trim() || null,
        attachment_data || null,
      ]
    );

    const [rows] = await client.query(
      `SELECT * FROM issue_reports WHERE id = ?`,
      [insertResult.insertId]
    );

    await createNotification(
      client,
      req.user.id,
      'Issue received',
      `Your issue "${title.trim()}" was submitted successfully and is awaiting review.`,
      'issue',
      '/student/issues'
    );

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listNotifications(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT *
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function markNotificationRead(req, res) {
  const { id } = req.params;
  try {
    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    const [rows] = await pool.query(
      `SELECT * FROM notifications WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listResourcesAdmin(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT kr.id, kr.title, kr.category, kr.description, kr.resource_type, kr.external_url, kr.file_name, kr.note_content, kr.audience, kr.section_scope, kr.is_published, kr.created_by, kr.created_at, kr.updated_at,
              u.email AS created_by_email
       FROM knowledge_resources kr
       LEFT JOIN users u ON u.id = kr.created_by
       ORDER BY kr.updated_at DESC, kr.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createResource(req, res) {
  const {
    title,
    category,
    description,
    resource_type,
    external_url,
    file_name,
    file_data,
    note_content,
    audience = 'students',
    section_scope = 'all',
    is_published = true,
  } = req.body;

  if (!title?.trim() || !category?.trim() || !['link', 'file', 'note'].includes(resource_type)) {
    return res.status(400).json({ error: 'Title, category, and valid resource type are required' });
  }

  try {
    const [insertResult] = await pool.query(
      `INSERT INTO knowledge_resources
       (title, category, description, resource_type, external_url, file_name, file_data, note_content, audience, section_scope, is_published, created_by, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [
        title.trim(),
        category.trim(),
        description?.trim() || null,
        resource_type,
        external_url?.trim() || null,
        file_name?.trim() || null,
        file_data || null,
        note_content?.trim() || null,
        audience,
        section_scope,
        Boolean(is_published),
        req.user.id,
      ]
    );
    const [rows] = await pool.query(
      `SELECT * FROM knowledge_resources WHERE id = ?`,
      [insertResult.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateResource(req, res) {
  const { id } = req.params;
  try {
    const [existingRows] = await pool.query('SELECT * FROM knowledge_resources WHERE id = ?', [id]);
    if (!existingRows.length) return res.status(404).json({ error: 'Resource not found' });
    const existing = existingRows[0];
    const merged = { ...existing, ...req.body };

    await pool.query(
      `UPDATE knowledge_resources
       SET title = ?,
           category = ?,
           description = ?,
           resource_type = ?,
           external_url = ?,
           file_name = ?,
           file_data = ?,
           note_content = ?,
           audience = ?,
           section_scope = ?,
           is_published = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [
        merged.title?.trim() || '',
        merged.category?.trim() || '',
        merged.description?.trim() || null,
        merged.resource_type,
        merged.external_url?.trim() || null,
        merged.file_name?.trim() || null,
        merged.file_data || null,
        merged.note_content?.trim() || null,
        merged.audience,
        merged.section_scope,
        Boolean(merged.is_published),
        id,
      ]
    );

    const [rows] = await pool.query('SELECT * FROM knowledge_resources WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteResource(req, res) {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM knowledge_resources WHERE id = ?', [id]);
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listStudentResources(req, res) {
  const section = req.user.section;
  try {
    const [rows] = await pool.query(
      `SELECT id, title, category, description, resource_type, external_url, file_name, note_content, audience, section_scope, is_published, created_at, updated_at
       FROM knowledge_resources
       WHERE is_published = TRUE
         AND audience IN ('students', 'both')
         AND section_scope IN ('all', ?)
       ORDER BY updated_at DESC, created_at DESC`,
      [section]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMyReadingProgress(req, res) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  try {
    const [rows] = await pool.query(
      `SELECT rp.*, kr.title AS resource_title, kr.category AS resource_category,
              kr.file_name, kr.resource_type
       FROM reading_progress rp
       JOIN knowledge_resources kr ON kr.id = rp.resource_id
       WHERE rp.user_id = ?
       ORDER BY rp.updated_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateMyReadingProgress(req, res) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { resource_id, progress, status, pages_read, total_pages, notes } = req.body;
  if (!resource_id) return res.status(400).json({ error: 'resource_id is required' });

  try {
    const [existingRows] = await pool.query(
      `SELECT id FROM reading_progress WHERE resource_id = ? AND user_id = ?`,
      [resource_id, req.user.id]
    );

    let resultRows;
    if (existingRows.length) {
      await pool.query(
        `UPDATE reading_progress
         SET progress = COALESCE(?, progress),
             status = COALESCE(?, status),
             pages_read = COALESCE(?, pages_read),
             total_pages = COALESCE(?, total_pages),
             notes = COALESCE(?, notes),
             updated_at = NOW()
         WHERE id = ?`,
        [progress ?? null, status || null, pages_read ?? null, total_pages ?? null, notes ?? null, existingRows[0].id]
      );
      [resultRows] = await pool.query(
        `SELECT * FROM reading_progress WHERE id = ?`,
        [existingRows[0].id]
      );
    } else {
      const [insertResult] = await pool.query(
        `INSERT INTO reading_progress (resource_id, user_id, progress, status, pages_read, total_pages, notes)
         VALUES (?,?,?,?,?,?,?)`,
        [resource_id, req.user.id, progress ?? 0, status || 'reading', pages_read ?? 0, total_pages ?? null, notes ?? null]
      );
      [resultRows] = await pool.query(
        `SELECT * FROM reading_progress WHERE id = ?`,
        [insertResult.insertId]
      );
    }

    res.json(resultRows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getAdminReadingProgress(req, res) {
  try {
    const { resource_id, student_id } = req.query;
    const { clause, params: sectionParams } = adminSectionFilter(req, 'u');
    const filters = [...sectionParams];
    let whereClause = '';

    if (resource_id) {
      filters.push(resource_id);
      whereClause += ' AND rp.resource_id = ?';
    }
    if (student_id) {
      filters.push(student_id);
      whereClause += ' AND rp.user_id = ?';
    }

    const [rows] = await pool.query(
      `SELECT rp.*,
              kr.title AS resource_title, kr.category AS resource_category,
              kr.file_name, kr.resource_type,
              u.email, p.full_name, u.section
       FROM reading_progress rp
       JOIN knowledge_resources kr ON kr.id = rp.resource_id
       JOIN users u ON u.id = rp.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
        WHERE u.role='student'${clause}${whereClause}
        ORDER BY rp.updated_at DESC`,
      filters
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listStudentUpdates,
  getStudentMonthlyPerformance,
  reviewStudentUpdate,
  listMyUpdates,
  createMyUpdate,
  listIssueReports,
  updateIssueReport,
  listMyIssues,
  createMyIssue,
  listNotifications,
  markNotificationRead,
  listResourcesAdmin,
  createResource,
  updateResource,
  deleteResource,
  listStudentResources,
  getMyReadingProgress,
  updateMyReadingProgress,
  getAdminReadingProgress,
};
