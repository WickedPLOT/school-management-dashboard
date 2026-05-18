const pool = require('../config/db');

// ── helpers ──────────────────────────────────────────────────────────────────
function sectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section=$1`, params: [req.user.section] };
}

// ── Student Accounts ─────────────────────────────────────────────────────────

async function getPendingUsers(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, g.parent_name, g.parent_phone, g.parent_email, p.institution, p.course
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.status='pending' AND u.role='student'${clause}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getAllStudents(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, g.parent_name, g.parent_phone, g.parent_email, p.institution, p.course
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
       ORDER BY p.full_name ASC`,
      params
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getRejectedStudents(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, g.parent_name, g.parent_phone, g.parent_email, p.institution, p.course
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='rejected'${clause}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function approveUser(req, res) { await _updateStatus(req, res, 'approved'); }
async function rejectUser(req, res)  { await _updateStatus(req, res, 'rejected'); }

async function _updateStatus(req, res, status) {
  const { id } = req.params;
  try {
    const check = await pool.query('SELECT section FROM users WHERE id=$1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'super_admin' && check.rows[0].section !== req.user.section)
      return res.status(403).json({ error: 'Forbidden' });
    await pool.query('UPDATE users SET status=$1 WHERE id=$2', [status, id]);
    res.json({ message: `User ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Student Profiles ──────────────────────────────────────────────────────────

async function searchProfiles(req, res) {
  const { q = '' } = req.query;
  const { clause, params } = sectionFilter(req);
  const search = `%${q}%`;
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.section, u.status,
              p.full_name, p.gender, p.phone, p.institution, p.course,
              p.year_of_study, p.quran_level, p.home_county, g.parent_name, g.parent_phone, g.parent_email
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
         AND (p.full_name ILIKE $${params.length + 1} OR u.email ILIKE $${params.length + 1}
              OR p.institution ILIKE $${params.length + 1})
       ORDER BY p.full_name ASC LIMIT 100`,
      [...params, search]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getIncompleteProfiles(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.section,
              p.full_name, p.phone, p.institution, p.course, p.gender
             ,g.parent_name, g.parent_phone, g.parent_email
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
         AND (p.full_name IS NULL OR p.phone IS NULL OR p.institution IS NULL OR p.course IS NULL)
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getStudentProfile(req, res) {
  const { id } = req.params;
  try {
    const r = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, p.institution, p.course,
              p.year_of_study, p.quran_level, p.home_county, g.parent_name, g.parent_phone, g.parent_email
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.id=$1`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    const student = r.rows[0];
    if (req.user.role !== 'super_admin' && student.section !== req.user.section)
      return res.status(403).json({ error: 'Forbidden' });
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const [pending, approved, rejected, incomplete] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM users WHERE role='student' AND status='pending'${clause}`, params),
      pool.query(`SELECT COUNT(*) FROM users WHERE role='student' AND status='approved'${clause}`, params),
      pool.query(`SELECT COUNT(*) FROM users WHERE role='student' AND status='rejected'${clause}`, params),
      pool.query(
        `SELECT COUNT(*) FROM users u LEFT JOIN profiles p ON p.user_id=u.id
         WHERE u.role='student' AND u.status='approved'${clause}
           AND (p.full_name IS NULL OR p.phone IS NULL OR p.institution IS NULL)`,
        params
      ),
    ]);
    res.json({
      pending:    parseInt(pending.rows[0].count),
      approved:   parseInt(approved.rows[0].count),
      rejected:   parseInt(rejected.rows[0].count),
      incomplete: parseInt(incomplete.rows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Super admin: manage section admins ───────────────────────────────────────

async function getAdmins(req, res) {
  try {
    const r = await pool.query(
      `SELECT id, email, role, section, status, created_at
       FROM users WHERE role IN ('brothers_admin','sisters_admin')
       ORDER BY section, email`
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createAdmin(req, res) {
  const bcrypt = require('bcrypt');
  const { email, password, section } = req.body;
  if (!email || !password || !section) return res.status(400).json({ error: 'email, password, section required' });
  if (!['brothers', 'sisters'].includes(section)) return res.status(400).json({ error: 'Invalid section' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const role = section === 'brothers' ? 'brothers_admin' : 'sisters_admin';
    const r = await pool.query(
      `INSERT INTO users (email, password_hash, role, section, status)
       VALUES ($1,$2,$3,$4,'approved') RETURNING id, email, role, section`,
      [email, hash, role, section]
    );
    res.status(201).json(r.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function updateAdmin(req, res) {
  const bcrypt = require('bcrypt');
  const { id } = req.params;
  const { email, password } = req.body;
  try {
    if (email) await pool.query('UPDATE users SET email=$1 WHERE id=$2', [email, id]);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, id]);
    }
    res.json({ message: 'Admin updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function deleteAdmin(req, res) {
  const { id } = req.params;
  try {
    await pool.query("UPDATE users SET status='rejected' WHERE id=$1 AND role IN ('brothers_admin','sisters_admin')", [id]);
    res.json({ message: 'Admin deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function addNote(req, res) {
  const { id } = req.params;
  const { note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note is required' });
  try {
    const check = await pool.query('SELECT section FROM users WHERE id=$1', [id]);
    if (!check.rows.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'super_admin' && check.rows[0].section !== req.user.section)
      return res.status(403).json({ error: 'Forbidden' });
    await pool.query(
      'INSERT INTO registration_notes (user_id, admin_id, note) VALUES ($1,$2,$3)',
      [id, req.user.id, note.trim()]
    );
    res.status(201).json({ message: 'Note added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getNotes(req, res) {
  const { id } = req.params;
  try {
    const r = await pool.query(
      `SELECT n.id, n.note, n.created_at, u.email AS admin_email
       FROM registration_notes n
       LEFT JOIN users u ON u.id = n.admin_id
       WHERE n.user_id=$1 ORDER BY n.created_at DESC`,
      [id]
    );
    res.json(r.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

module.exports = {
  getPendingUsers, getAllStudents, getRejectedStudents,
  approveUser, rejectUser,
  searchProfiles, getIncompleteProfiles, getStudentProfile,
  getDashboardStats,
  getAdmins, createAdmin, updateAdmin, deleteAdmin,
  addNote, getNotes,
};
