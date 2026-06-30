const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { issueVerificationCode, verifyCode } = require('../services/communicationService');
const { getAppSettings } = require('../services/settingsService');

function toTitleCase(str) {
  if (!str) return str;
  return str.replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .replace(/\b(Of|In|And|The|For|On|At|To|A|An)\b/g, m => m.toLowerCase())
    .replace(/^./, c => c.toUpperCase());
}

const DOCUMENT_TYPES = ['passport_document', 'id_front', 'id_back'];

async function ensureStudentDocumentsTable(clientOrPool = pool) {
  await clientOrPool.query(`CREATE TABLE IF NOT EXISTS student_documents (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(120),
    file_data TEXT,
    review_status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','approved','rejected')),
    review_note TEXT,
    reviewed_by INT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

// POST /api/auth/register  (invite token optional)
async function register(req, res) {
  const {
    invite_token,
    email, password,
    full_name, phone, gender, section: requestedSection,
    institution, course, year_of_study, quran_level, home_county,
    nationality, country, county, sub_county, passport_photo_data, entry_date,
    parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone,
    emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation,
    emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation,
  } = req.body;

  if (!email || !password || !full_name || !gender)
    return res.status(400).json({ error: 'email, password, full_name, gender are required' });
  if (!['male', 'female'].includes(gender))
    return res.status(400).json({ error: 'gender must be male or female' });
  if (!passport_photo_data)
    return res.status(400).json({ error: 'Passport photo is required' });
  const regDocs = normalizeDocuments(req.body);
  const hasIdFront = regDocs.some((d) => d.document_type === 'id_front');
  const hasIdBack = regDocs.some((d) => d.document_type === 'id_back');
  if (hasIdFront !== hasIdBack)
    return res.status(400).json({ error: 'Both ID Front and ID Back must be uploaded together' });
  if (!regDocs.length)
    return res.status(400).json({ error: 'At least one verification document is required — upload your Passport or both ID sides' });

  const client = await pool.getConnection();
  try {
    await client.query('START TRANSACTION');
    const appSettings = await getAppSettings();

    // Validate invite token only when a registration link was used.
    let inviteSection = null;
    if (invite_token) {
      const [invRows] = await client.query(
        "SELECT * FROM invite_tokens WHERE token=? AND used < max_uses AND expires_at > NOW()",
        [invite_token]
      );
      if (!invRows.length) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid, expired, or fully used invite link' });
      }
      inviteSection = invRows[0].section_scope || null;
    }

    // Check email uniqueness
    const [exists] = await client.query('SELECT id FROM users WHERE email=?', [email]);
    if (exists.length) return res.status(409).json({ error: 'Email already registered' });

    // Section: use invite token's section_scope if set, then user-selected, then derive from gender
    const section = inviteSection
      || (['brothers', 'sisters'].includes(requestedSection) ? requestedSection : null)
      || (gender === 'male' ? 'brothers' : 'sisters');
    const password_hash = await bcrypt.hash(password, 10);

    const [userInsert] = await client.query(
      'INSERT INTO users (email, password_hash, role, section, status) VALUES (?,?,?,?,?)',
      [email, password_hash, 'student', section, appSettings.approval_required ? 'pending' : 'approved']
    );
    const userId = userInsert.insertId;

    await client.query(
      `INSERT INTO profiles (user_id, full_name, phone, gender, institution, course, year_of_study, quran_level, home_county)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [userId, full_name, phone, gender, toTitleCase(institution), toTitleCase(course), year_of_study || null, quran_level, home_county]
    );

    await client.query(
      `INSERT INTO student_profile_extensions (user_id, nationality, country, county, sub_county, passport_photo_data, entry_date, updated_at)
       VALUES (?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         nationality=VALUES(nationality), country=VALUES(country), county=VALUES(county),
         sub_county=VALUES(sub_county), passport_photo_data=VALUES(passport_photo_data),
         entry_date=VALUES(entry_date), updated_at=NOW()`,
      [userId, nationality, country, county, sub_county, passport_photo_data, entry_date || null]
    );

    await client.query(
      `INSERT INTO guardian_contacts (user_id, parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         parent_name=VALUES(parent_name), parent_phone=VALUES(parent_phone), parent_email=VALUES(parent_email),
         alt_student_phone=VALUES(alt_student_phone), alt_parent_phone=VALUES(alt_parent_phone),
         emergency_contact_1_name=VALUES(emergency_contact_1_name), emergency_contact_1_phone=VALUES(emergency_contact_1_phone), emergency_contact_1_relation=VALUES(emergency_contact_1_relation),
         emergency_contact_2_name=VALUES(emergency_contact_2_name), emergency_contact_2_phone=VALUES(emergency_contact_2_phone), emergency_contact_2_relation=VALUES(emergency_contact_2_relation), updated_at=NOW()`,
      [userId, parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation]
    );

    await saveStudentDocuments(client, userId, req.body);

    // Increment use count when registration came from an invite link.
    if (invite_token) {
      await client.query('UPDATE invite_tokens SET used = used + 1 WHERE token=?', [invite_token]);
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: appSettings.approval_required
        ? 'Registration submitted. Awaiting admin approval.'
        : 'Registration completed successfully.',
      status: appSettings.approval_required ? 'pending' : 'approved',
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

// POST /api/auth/login
async function login(req, res) {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.status === 'pending')  return res.status(403).json({ error: 'Account pending approval' });
    if (user.status === 'rejected') return res.status(403).json({ error: 'Account rejected' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, role: user.role, section: user.section },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role, section: user.section } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/validate-invite?token=xxx
async function validateInvite(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).json({ error: 'Token required' });
  try {
    const [rows] = await pool.query(
      "SELECT id, section_scope FROM invite_tokens WHERE token=? AND used < max_uses AND expires_at > NOW()",
      [token]
    );
    if (!rows.length) return res.status(400).json({ valid: false, error: 'Invalid, expired, or fully used invite link' });
    res.json({ valid: true, section_scope: rows[0].section_scope || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function requestEmailCode(req, res) {
  const { email, purpose = 'verification' } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    const result = await issueVerificationCode(email, purpose);
    res.json({ message: 'Verification code sent', expires_at: result.expiresAt });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function verifyEmailCode(req, res) {
  const { email, purpose = 'verification', code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Email and code are required' });
  try {
    const valid = await verifyCode(email, purpose, code);
    if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code' });
    res.json({ verified: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, validateInvite, requestEmailCode, verifyEmailCode };
