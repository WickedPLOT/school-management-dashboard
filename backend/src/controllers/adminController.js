const pool = require('../config/db');
const DOCUMENT_TYPES = ['passport_document', 'id_front', 'id_back', 'good_conduct', 'other_document'];

async function ensureStudentDocumentsTable(clientOrPool = pool) {
  await clientOrPool.query(`CREATE TABLE IF NOT EXISTS student_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(120),
    file_data TEXT,
    review_status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','approved','rejected')),
    review_note TEXT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, document_type)
  )`);
}

function normalizeDocuments(body = {}) {
  const docs = Array.isArray(body.documents) ? body.documents : [];
  for (const type of DOCUMENT_TYPES) {
    const file_data = body[`${type}_data`];
    if (file_data) docs.push({
      document_type: type,
      file_name: body[`${type}_name`] || type,
      mime_type: body[`${type}_mime`] || null,
      file_data,
    });
  }
  return docs.filter((doc) => DOCUMENT_TYPES.includes(doc.document_type) && doc.file_data);
}

async function saveStudentDocuments(client, userId, body = {}) {
  await ensureStudentDocumentsTable(client);
  const docs = normalizeDocuments(body);
  for (const doc of docs) {
    await client.query(
      `INSERT INTO student_documents (user_id, document_type, file_name, mime_type, file_data, updated_at)
       VALUES (?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         file_name=VALUES(file_name),
         mime_type=VALUES(mime_type),
         file_data=VALUES(file_data),
         review_status='submitted',
         review_note=NULL,
         reviewed_by=NULL,
         reviewed_at=NULL,
         updated_at=NOW()`,
      [userId, doc.document_type, doc.file_name || doc.document_type, doc.mime_type || null, doc.file_data]
    );
  }
}

async function listStudentDocuments(userId) {
  await ensureStudentDocumentsTable(pool);
  const [rows] = await pool.query(
    `SELECT id, document_type, file_name, mime_type, file_data, review_status, review_note, reviewed_at, created_at, updated_at
     FROM student_documents
     WHERE user_id=?
     ORDER BY document_type ASC`,
    [userId]
  );
  return rows;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function sectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section=?`, params: [req.user.section] };
}

// ── Student Accounts ─────────────────────────────────────────────────────────

async function getPendingUsers(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, sx.nationality, sx.country, sx.county, sx.sub_county, sx.entry_date, g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation, p.institution, p.course
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN student_profile_extensions sx ON sx.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.status='pending' AND u.role='student'${clause}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getAllStudents(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, sx.nationality, sx.country, sx.county, sx.sub_county, sx.entry_date, g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation, p.institution, p.course
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN student_profile_extensions sx ON sx.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
       ORDER BY p.full_name ASC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getRejectedStudents(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, sx.nationality, sx.country, sx.county, sx.sub_county, sx.entry_date, g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation, p.institution, p.course
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN student_profile_extensions sx ON sx.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='rejected'${clause}
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function approveUser(req, res) { await _updateStatus(req, res, 'approved'); }
async function rejectUser(req, res)  { await _updateStatus(req, res, 'rejected'); }

async function _updateStatus(req, res, status) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query('SELECT section FROM users WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'super_admin' && rows[0].section !== req.user.section)
      return res.status(403).json({ error: 'Forbidden' });
    await pool.query('UPDATE users SET status=? WHERE id=?', [status, id]);
    res.json({ message: `User ${status}` });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Student Profiles ──────────────────────────────────────────────────────────

async function searchProfiles(req, res) {
  const { q = '' } = req.query;
  const { clause, params } = sectionFilter(req);
  const search = `%${q}%`;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, sx.nationality, sx.country, sx.county, sx.sub_county, sx.passport_photo_data, sx.entry_date, p.institution, p.course,
              p.year_of_study, p.quran_level, p.home_county, g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN student_profile_extensions sx ON sx.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
         AND (p.full_name LIKE ? OR u.email LIKE ?
              OR p.institution LIKE ?)
       ORDER BY p.full_name ASC LIMIT 100`,
      [...params, search, search, search]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getIncompleteProfiles(req, res) {
  const { clause, params } = sectionFilter(req);
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.phone, sx.nationality, sx.country, sx.county, sx.sub_county, sx.passport_photo_data, sx.entry_date, p.institution, p.course, p.gender
             ,g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN student_profile_extensions sx ON sx.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.role='student' AND u.status='approved'${clause}
         AND (p.full_name IS NULL OR p.phone IS NULL OR p.institution IS NULL OR p.course IS NULL)
       ORDER BY u.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getStudentProfile(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.section, u.status, u.created_at,
              p.full_name, p.gender, p.phone, sx.nationality, sx.country, sx.county, sx.sub_county, sx.passport_photo_data, sx.entry_date, p.institution, p.course,
              p.year_of_study, p.quran_level, p.home_county, g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation
       FROM users u LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN student_profile_extensions sx ON sx.user_id = u.id
       LEFT JOIN guardian_contacts g ON g.user_id = u.id
       WHERE u.id=?`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const student = rows[0];
    if (req.user.role !== 'super_admin' && student.section !== req.user.section)
      return res.status(403).json({ error: 'Forbidden' });
    student.documents = await listStudentDocuments(id);
    res.json(student);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Dashboard stats ───────────────────────────────────────────────────────────

async function getDashboardStats(req, res) {
  const { clause, params } = req.user.role === 'super_admin'
    ? { clause: '', params: [] }
    : { clause: ' AND section=?', params: [req.user.section] };
  const userJoinClause = req.user.role === 'super_admin'
    ? ''
    : ' AND u.section=?';
  try {
    const [[pendingRows], [approvedRows], [rejectedRows], [incompleteRows]] = await Promise.all([
      pool.query(`SELECT COUNT(*) AS count FROM users WHERE role='student' AND status='pending'${clause}`, params),
      pool.query(`SELECT COUNT(*) AS count FROM users WHERE role='student' AND status='approved'${clause}`, params),
      pool.query(`SELECT COUNT(*) AS count FROM users WHERE role='student' AND status='rejected'${clause}`, params),
      pool.query(
        `SELECT COUNT(*) AS count FROM users u LEFT JOIN profiles p ON p.user_id=u.id
         WHERE u.role='student' AND u.status='approved'${userJoinClause}
           AND (p.full_name IS NULL OR p.phone IS NULL OR p.institution IS NULL)`,
        params
      ),
    ]);
    res.json({
      pending:    parseInt(pendingRows[0].count),
      approved:   parseInt(approvedRows[0].count),
      rejected:   parseInt(rejectedRows[0].count),
      incomplete: parseInt(incompleteRows[0].count),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

// ── Super admin: manage section admins ───────────────────────────────────────

async function getAdmins(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT id, email, role, section, status, created_at
       FROM users WHERE role IN ('brothers_admin','sisters_admin')
       ORDER BY section, email`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function createAdmin(req, res) {
  const bcrypt = require('bcrypt');
  const { email, password, section } = req.body;
  if (!email || !password || !section) return res.status(400).json({ error: 'email, password, section required' });
  if (!['brothers', 'sisters'].includes(section)) return res.status(400).json({ error: 'Invalid section' });
  try {
    const [existing] = await pool.query('SELECT id FROM users WHERE email=?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already exists' });
    const hash = await bcrypt.hash(password, 10);
    const role = section === 'brothers' ? 'brothers_admin' : 'sisters_admin';
    const [insertResult] = await pool.query(
      `INSERT INTO users (email, password_hash, role, section, status)
       VALUES (?,?,?,?,'approved')`,
      [email, hash, role, section]
    );
    const [rows] = await pool.query(
      'SELECT id, email, role, section FROM users WHERE id=?',
      [insertResult.insertId]
    );
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function updateAdmin(req, res) {
  const bcrypt = require('bcrypt');
  const { id } = req.params;
  const { email, password } = req.body;
  try {
    if (email) await pool.query('UPDATE users SET email=? WHERE id=?', [email, id]);
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, id]);
    }
    res.json({ message: 'Admin updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function deleteAdmin(req, res) {
  const { id } = req.params;
  try {
    await pool.query("UPDATE users SET status='rejected' WHERE id=? AND role IN ('brothers_admin','sisters_admin')", [id]);
    res.json({ message: 'Admin deactivated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function addNote(req, res) {
  const { id } = req.params;
  const { note } = req.body;
  if (!note?.trim()) return res.status(400).json({ error: 'Note is required' });
  try {
    const [rows] = await pool.query('SELECT section FROM users WHERE id=?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role !== 'super_admin' && rows[0].section !== req.user.section)
      return res.status(403).json({ error: 'Forbidden' });
    await pool.query(
      'INSERT INTO registration_notes (user_id, admin_id, note) VALUES (?,?,?)',
      [id, req.user.id, note.trim()]
    );
    res.status(201).json({ message: 'Note added' });
  } catch (err) { res.status(500).json({ error: err.message }); }
}

async function getNotes(req, res) {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT n.id, n.note, n.created_at, u.email AS admin_email
       FROM registration_notes n
       LEFT JOIN users u ON u.id = n.admin_id
       WHERE n.user_id=? ORDER BY n.created_at DESC`,
      [id]
    );
    res.json(rows);
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
