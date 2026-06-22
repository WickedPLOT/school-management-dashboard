const pool = require('../config/db');

function sectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = ?`, params: [req.user.section] };
}

async function listDisciplinaryRecords(req, res) {
  const { status = 'all', severity = 'all' } = req.query;
  const { clause, params } = sectionFilter(req, 'u');
  const values = [...params];
  let filters = '';

  if (status !== 'all') {
    values.push(status);
    filters += ' AND dr.status = ?';
  }
  if (severity !== 'all') {
    values.push(severity);
    filters += ' AND dr.severity = ?';
  }

  try {
    const [rows] = await pool.query(
      `SELECT dr.*, u.email, u.section, p.full_name, creator.email AS created_by_email, resolver.email AS resolved_by_email
       FROM disciplinary_records dr
       JOIN users u ON u.id = dr.user_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN users creator ON creator.id = dr.created_by
       LEFT JOIN users resolver ON resolver.id = dr.resolved_by
       WHERE u.role = 'student'${clause}${filters}
       ORDER BY dr.incident_date DESC, dr.created_at DESC`,
      values
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createDisciplinaryRecord(req, res) {
  const { user_id, incident_date, category, severity = 'minor', title, description, action_taken, status = 'open' } = req.body;
  if (!user_id || !incident_date || !category?.trim() || !title?.trim() || !description?.trim()) {
    return res.status(400).json({ error: 'student, incident date, category, title and description are required' });
  }
  if (!['minor', 'moderate', 'serious'].includes(severity)) return res.status(400).json({ error: 'Invalid severity' });
  if (!['open', 'under_review', 'resolved'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

  try {
    const [studentRows] = await pool.query('SELECT id, section FROM users WHERE id=? AND role=?', [user_id, 'student']);
    if (!studentRows.length) return res.status(404).json({ error: 'Student not found' });
    if (req.user.role !== 'super_admin' && studentRows[0].section !== req.user.section) return res.status(403).json({ error: 'Forbidden' });

    const [insertResult] = await pool.query(
      `INSERT INTO disciplinary_records
       (user_id, incident_date, category, severity, title, description, action_taken, status, created_by, resolved_by, resolved_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        user_id,
        incident_date,
        category.trim(),
        severity,
        title.trim(),
        description.trim(),
        action_taken?.trim() || null,
        status,
        req.user.id,
        status === 'resolved' ? req.user.id : null,
        status === 'resolved' ? new Date() : null,
      ]
    );
    const [rows] = await pool.query('SELECT * FROM disciplinary_records WHERE id = ?', [insertResult.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateDisciplinaryRecord(req, res) {
  const { id } = req.params;
  const client = await pool.getConnection();
  try {
    await client.query('BEGIN');
    const [existingRows] = await client.query(
      `SELECT dr.*, u.section
       FROM disciplinary_records dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id = ?`,
      [id]
    );
    if (!existingRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Disciplinary record not found' });
    }
    const existing = existingRows[0];
    if (req.user.role !== 'super_admin' && existing.section !== req.user.section) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Forbidden' });
    }

    const merged = { ...existing, ...req.body };
    if (!['minor', 'moderate', 'serious'].includes(merged.severity)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid severity' });
    }
    if (!['open', 'under_review', 'resolved'].includes(merged.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Invalid status' });
    }

    const resolvedNow = merged.status === 'resolved' && existing.status !== 'resolved';
    await client.query(
      `UPDATE disciplinary_records
       SET incident_date=?, category=?, severity=?, title=?, description=?,
           action_taken=?, status=?, resolved_by=?, resolved_at=?, updated_at=NOW()
       WHERE id=?`,
      [
        merged.incident_date,
        merged.category?.trim(),
        merged.severity,
        merged.title?.trim(),
        merged.description?.trim(),
        merged.action_taken?.trim() || null,
        merged.status,
        resolvedNow ? req.user.id : existing.resolved_by,
        resolvedNow ? new Date() : existing.resolved_at,
        id,
      ]
    );
    const [rows] = await client.query('SELECT * FROM disciplinary_records WHERE id = ?', [id]);
    await client.query('COMMIT');
    res.json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function deleteDisciplinaryRecord(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT dr.id, u.section
       FROM disciplinary_records dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id=?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Disciplinary record not found' });
    if (req.user.role !== 'super_admin' && rows[0].section !== req.user.section) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM disciplinary_records WHERE id=?', [id]);
    res.json({ message: 'Disciplinary record deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  listDisciplinaryRecords,
  createDisciplinaryRecord,
  updateDisciplinaryRecord,
  deleteDisciplinaryRecord,
};
