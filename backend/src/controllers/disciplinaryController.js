const pool = require('../config/db');

function sectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = $1`, params: [req.user.section] };
}

async function listDisciplinaryRecords(req, res) {
  const { status = 'all', severity = 'all' } = req.query;
  const { clause, params } = sectionFilter(req, 'u');
  const values = [...params];
  let filters = '';

  if (status !== 'all') {
    values.push(status);
    filters += ` AND dr.status = $${values.length}`;
  }
  if (severity !== 'all') {
    values.push(severity);
    filters += ` AND dr.severity = $${values.length}`;
  }

  try {
    const result = await pool.query(
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
    res.json(result.rows);
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
    const student = await pool.query('SELECT id, section FROM users WHERE id=$1 AND role=$2', [user_id, 'student']);
    if (!student.rows.length) return res.status(404).json({ error: 'Student not found' });
    if (req.user.role !== 'super_admin' && student.rows[0].section !== req.user.section) return res.status(403).json({ error: 'Forbidden' });

    const result = await pool.query(
      `INSERT INTO disciplinary_records
       (user_id, incident_date, category, severity, title, description, action_taken, status, created_by, resolved_by, resolved_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
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
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function updateDisciplinaryRecord(req, res) {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingResult = await client.query(
      `SELECT dr.*, u.section
       FROM disciplinary_records dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id = $1`,
      [id]
    );
    if (!existingResult.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Disciplinary record not found' });
    }
    const existing = existingResult.rows[0];
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
    const result = await client.query(
      `UPDATE disciplinary_records
       SET incident_date=$1, category=$2, severity=$3, title=$4, description=$5,
           action_taken=$6, status=$7, resolved_by=$8, resolved_at=$9, updated_at=NOW()
       WHERE id=$10
       RETURNING *`,
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
    await client.query('COMMIT');
    res.json(result.rows[0]);
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
    const existing = await pool.query(
      `SELECT dr.id, u.section
       FROM disciplinary_records dr
       JOIN users u ON u.id = dr.user_id
       WHERE dr.id=$1`,
      [id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Disciplinary record not found' });
    if (req.user.role !== 'super_admin' && existing.rows[0].section !== req.user.section) return res.status(403).json({ error: 'Forbidden' });
    await pool.query('DELETE FROM disciplinary_records WHERE id=$1', [id]);
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
