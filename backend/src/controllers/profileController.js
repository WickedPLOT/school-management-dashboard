const pool = require('../config/db');
const { getAppSettings } = require('../services/settingsService');

function toTitleCase(str) {
  if (!str) return str;
  return str.replace(/\b\w+/g, w => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .replace(/\b(Of|In|And|The|For|On|At|To|A|An)\b/g, m => m.toLowerCase())
    .replace(/^./, c => c.toUpperCase());
}

const DOCUMENT_TYPES = ['id_front', 'id_back', 'passport_document', 'good_conduct', 'other_document'];

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
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
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

async function getProfile(req, res) {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, sx.nationality, sx.country, sx.county, sx.sub_county, sx.passport_photo_data, sx.entry_date,
              g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation
       FROM profiles p
       LEFT JOIN student_profile_extensions sx ON sx.user_id = p.user_id
       LEFT JOIN guardian_contacts g ON g.user_id = p.user_id
       WHERE p.user_id=?`,
      [req.user.id]
    );
    const profile = rows[0] || null;
    if (profile) profile.documents = await listStudentDocuments(req.user.id);
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function upsertProfile(req, res) {
  const {
    full_name,
    phone,
    parent_name,
    parent_phone,
    parent_email,
    alt_student_phone,
    alt_parent_phone,
    emergency_contact_1_name,
    emergency_contact_1_phone,
    emergency_contact_1_relation,
    emergency_contact_2_name,
    emergency_contact_2_phone,
    emergency_contact_2_relation,
    gender,
    institution,
    course,
    year_of_study,
    quran_level,
    home_county,
    nationality,
    country,
    county,
    sub_county,
    passport_photo_data,
  } = req.body;
  const client = await pool.getConnection();
  try {
    const settings = await getAppSettings();
    if (req.user.role === 'student' && !settings.allow_student_profile_edits) {
      return res.status(403).json({ error: 'Student profile edits are currently disabled by the administrator' });
    }
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO profiles (user_id, full_name, phone, gender, institution, course, year_of_study, quran_level, home_county)
       VALUES (?,?,?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         full_name=VALUES(full_name), phone=VALUES(phone),
         gender=VALUES(gender),
         institution=VALUES(institution), course=VALUES(course), year_of_study=VALUES(year_of_study),
         quran_level=VALUES(quran_level), home_county=VALUES(home_county)`,
      [
        req.user.id,
        full_name,
        phone,
        gender,
        toTitleCase(institution),
        toTitleCase(course),
        year_of_study,
        quran_level,
        home_county,
      ]
    );

    const [profileRows] = await client.query('SELECT * FROM profiles WHERE user_id = ?', [req.user.id]);

    await client.query(
      `INSERT INTO student_profile_extensions (user_id, nationality, country, county, sub_county, passport_photo_data, updated_at)
       VALUES (?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         nationality=VALUES(nationality),
         country=VALUES(country),
         county=VALUES(county),
         sub_county=VALUES(sub_county),
         passport_photo_data=COALESCE(VALUES(passport_photo_data), passport_photo_data),
         updated_at=NOW()`,
      [req.user.id, nationality, country, county, sub_county, passport_photo_data || null]
    );

    await client.query(
      `INSERT INTO guardian_contacts (user_id, parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,NOW())
       ON DUPLICATE KEY UPDATE
         parent_name=VALUES(parent_name),
         parent_phone=VALUES(parent_phone),
         parent_email=VALUES(parent_email),
         alt_student_phone=VALUES(alt_student_phone),
         alt_parent_phone=VALUES(alt_parent_phone),
         emergency_contact_1_name=VALUES(emergency_contact_1_name),
         emergency_contact_1_phone=VALUES(emergency_contact_1_phone),
         emergency_contact_1_relation=VALUES(emergency_contact_1_relation),
         emergency_contact_2_name=VALUES(emergency_contact_2_name),
         emergency_contact_2_phone=VALUES(emergency_contact_2_phone),
         emergency_contact_2_relation=VALUES(emergency_contact_2_relation),
         updated_at=NOW()`,
      [req.user.id, parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation]
    );

    await saveStudentDocuments(client, req.user.id, req.body);
    await client.query('COMMIT');
    res.json(profileRows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

module.exports = { getProfile, upsertProfile };
