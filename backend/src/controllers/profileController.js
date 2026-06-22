const pool = require('../config/db');
const { getAppSettings } = require('../services/settingsService');

const DOCUMENT_TYPES = ['id_front', 'id_back', 'passport_document', 'good_conduct', 'other_document'];

async function ensureStudentDocumentsTable(clientOrPool = pool) {
  await clientOrPool.query(`CREATE TABLE IF NOT EXISTS student_documents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL,
    file_name VARCHAR(255),
    mime_type VARCHAR(120),
    file_data TEXT,
    review_status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (review_status IN ('submitted','approved','rejected')),
    review_note TEXT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
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
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (user_id, document_type) DO UPDATE SET
         file_name=EXCLUDED.file_name,
         mime_type=EXCLUDED.mime_type,
         file_data=EXCLUDED.file_data,
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
  const result = await pool.query(
    `SELECT id, document_type, file_name, mime_type, file_data, review_status, review_note, reviewed_at, created_at, updated_at
     FROM student_documents
     WHERE user_id=$1
     ORDER BY document_type ASC`,
    [userId]
  );
  return result.rows;
}

async function getProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.*, sx.nationality, sx.country, sx.county, sx.sub_county, sx.passport_photo_data, sx.entry_date,
              g.parent_name, g.parent_phone, g.parent_email, g.alt_student_phone, g.alt_parent_phone, g.emergency_contact_1_name, g.emergency_contact_1_phone, g.emergency_contact_1_relation, g.emergency_contact_2_name, g.emergency_contact_2_phone, g.emergency_contact_2_relation
       FROM profiles p
       LEFT JOIN student_profile_extensions sx ON sx.user_id = p.user_id
       LEFT JOIN guardian_contacts g ON g.user_id = p.user_id
       WHERE p.user_id=$1`,
      [req.user.id]
    );
    const profile = result.rows[0] || null;
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
  const client = await pool.connect();
  try {
    const settings = await getAppSettings();
    if (req.user.role === 'student' && !settings.allow_student_profile_edits) {
      return res.status(403).json({ error: 'Student profile edits are currently disabled by the administrator' });
    }
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO profiles (user_id, full_name, phone, gender, institution, course, year_of_study, quran_level, home_county)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name=EXCLUDED.full_name, phone=EXCLUDED.phone,
         gender=EXCLUDED.gender,
         institution=EXCLUDED.institution, course=EXCLUDED.course, year_of_study=EXCLUDED.year_of_study,
         quran_level=EXCLUDED.quran_level, home_county=EXCLUDED.home_county
       RETURNING *`,
      [
        req.user.id,
        full_name,
        phone,
        gender,
        institution,
        course,
        year_of_study,
        quran_level,
        home_county,
      ]
    );

    await client.query(
      `INSERT INTO student_profile_extensions (user_id, nationality, country, county, sub_county, passport_photo_data, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         nationality=EXCLUDED.nationality,
         country=EXCLUDED.country,
         county=EXCLUDED.county,
         sub_county=EXCLUDED.sub_county,
         passport_photo_data=COALESCE(EXCLUDED.passport_photo_data, student_profile_extensions.passport_photo_data),
         updated_at=NOW()`,
      [req.user.id, nationality, country, county, sub_county, passport_photo_data || null]
    );

    await client.query(
      `INSERT INTO guardian_contacts (user_id, parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         parent_name=EXCLUDED.parent_name,
         parent_phone=EXCLUDED.parent_phone,
         parent_email=EXCLUDED.parent_email,
         alt_student_phone=EXCLUDED.alt_student_phone,
         alt_parent_phone=EXCLUDED.alt_parent_phone,
         emergency_contact_1_name=EXCLUDED.emergency_contact_1_name,
         emergency_contact_1_phone=EXCLUDED.emergency_contact_1_phone,
         emergency_contact_1_relation=EXCLUDED.emergency_contact_1_relation,
         emergency_contact_2_name=EXCLUDED.emergency_contact_2_name,
         emergency_contact_2_phone=EXCLUDED.emergency_contact_2_phone,
         emergency_contact_2_relation=EXCLUDED.emergency_contact_2_relation,
         updated_at=NOW()`,
      [req.user.id, parent_name, parent_phone, parent_email, alt_student_phone, alt_parent_phone, emergency_contact_1_name, emergency_contact_1_phone, emergency_contact_1_relation, emergency_contact_2_name, emergency_contact_2_phone, emergency_contact_2_relation]
    );

    await saveStudentDocuments(client, req.user.id, req.body);
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

module.exports = { getProfile, upsertProfile };
