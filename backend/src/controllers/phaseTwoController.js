const pool = require('../config/db');

function adminSectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = $1`, params: [req.user.section] };
}

async function createNotification(client, userId, title, message, kind = 'general', actionUrl = null) {
  await client.query(
    `INSERT INTO notifications (user_id, title, message, kind, action_url)
     VALUES ($1,$2,$3,$4,$5)`,
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
    trackClause = ` AND su.track = $${filters.length}`;
  }

  try {
    const result = await pool.query(
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
    res.json(result.rows);
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT su.id, su.user_id, su.title, u.section
       FROM student_updates su
       JOIN users u ON u.id = su.user_id
       WHERE su.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Update not found' });
    }
    if (req.user.role !== 'super_admin' && existing.rows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await client.query(
      `UPDATE student_updates
       SET admin_note = $1,
           progress_score = $2,
           review_status = $3,
           reviewed_by = $4,
           reviewed_at = CASE WHEN $3 = 'reviewed' THEN NOW() ELSE NULL END
       WHERE id = $5
       RETURNING *`,
      [admin_note?.trim() || null, progress_score ?? null, review_status, req.user.id, id]
    );

    await createNotification(
      client,
      existing.rows[0].user_id,
      'Progress update reviewed',
      `Your update "${existing.rows[0].title}" was reviewed by an administrator.`,
      'progress',
      '/student/progress'
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);
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
    const result = await pool.query(
      `SELECT * FROM student_updates
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
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
    const result = await pool.query(
      `INSERT INTO student_updates (user_id, track, title, summary, details, progress_score)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [req.user.id, track, title.trim(), summary.trim(), details?.trim() || null, progress_score || null]
    );
    res.status(201).json(result.rows[0]);
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
    statusClause = ` AND i.status = $${filters.length}`;
  }

  try {
    const result = await pool.query(
      `SELECT i.*, u.email, u.section, p.full_name, p.phone, assignee.email AS assigned_to_email
       FROM issue_reports i
       JOIN users u ON u.id = i.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users assignee ON assignee.id = i.assigned_to
       WHERE u.role='student'${clause}${statusClause}
       ORDER BY i.updated_at DESC, i.created_at DESC`,
      filters
    );
    res.json(result.rows);
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existing = await client.query(
      `SELECT i.id, i.user_id, i.title, u.section
       FROM issue_reports i
       JOIN users u ON u.id = i.user_id
       WHERE i.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Issue not found' });
    }
    if (req.user.role !== 'super_admin' && existing.rows[0].section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updated = await client.query(
      `UPDATE issue_reports
       SET status = $1,
           admin_note = $2,
           assigned_to = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, admin_note?.trim() || null, req.user.id, id]
    );

    await createNotification(
      client,
      existing.rows[0].user_id,
      'Issue update',
      `Your issue "${existing.rows[0].title}" is now marked as ${status}.`,
      'issue',
      '/student/issues'
    );

    await client.query('COMMIT');
    res.json(updated.rows[0]);
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
    const result = await pool.query(
      `SELECT *
       FROM issue_reports
       WHERE user_id = $1
       ORDER BY updated_at DESC, created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO issue_reports (user_id, title, category, location, description, attachment_name, attachment_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
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

    await createNotification(
      client,
      req.user.id,
      'Issue received',
      `Your issue "${title.trim()}" was submitted successfully and is awaiting review.`,
      'issue',
      '/student/issues'
    );

    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function listNotifications(req, res) {
  try {
    const result = await pool.query(
      `SELECT *
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function markNotificationRead(req, res) {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Notification not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listResourcesAdmin(req, res) {
  try {
    const result = await pool.query(
      `SELECT kr.*, u.email AS created_by_email
       FROM knowledge_resources kr
       LEFT JOIN users u ON u.id = kr.created_by
       ORDER BY kr.updated_at DESC, kr.created_at DESC`
    );
    res.json(result.rows);
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
    const result = await pool.query(
      `INSERT INTO knowledge_resources
       (title, category, description, resource_type, external_url, file_name, file_data, note_content, audience, section_scope, is_published, created_by, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       RETURNING *`,
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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateResource(req, res) {
  const { id } = req.params;
  try {
    const existingResult = await pool.query('SELECT * FROM knowledge_resources WHERE id = $1', [id]);
    if (!existingResult.rows.length) return res.status(404).json({ error: 'Resource not found' });
    const existing = existingResult.rows[0];
    const merged = { ...existing, ...req.body };

    const result = await pool.query(
      `UPDATE knowledge_resources
       SET title = $1,
           category = $2,
           description = $3,
           resource_type = $4,
           external_url = $5,
           file_name = $6,
           file_data = $7,
           note_content = $8,
           audience = $9,
           section_scope = $10,
           is_published = $11,
           updated_at = NOW()
       WHERE id = $12
       RETURNING *`,
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
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function deleteResource(req, res) {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM knowledge_resources WHERE id = $1', [id]);
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function listStudentResources(req, res) {
  const section = req.user.section;
  try {
    const result = await pool.query(
      `SELECT *
       FROM knowledge_resources
       WHERE is_published = TRUE
         AND audience IN ('students', 'both')
         AND section_scope IN ('all', $1)
       ORDER BY updated_at DESC, created_at DESC`,
      [section]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listStudentUpdates,
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
};
