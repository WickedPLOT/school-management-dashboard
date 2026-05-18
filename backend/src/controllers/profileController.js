const pool = require('../config/db');
const { getAppSettings } = require('../services/settingsService');

async function getProfile(req, res) {
  try {
    const result = await pool.query(
      `SELECT p.*, g.parent_name, g.parent_phone, g.parent_email
       FROM profiles p
       LEFT JOIN guardian_contacts g ON g.user_id = p.user_id
       WHERE p.user_id=$1`,
      [req.user.id]
    );
    res.json(result.rows[0] || null);
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
    gender,
    institution,
    course,
    year_of_study,
    quran_level,
    home_county,
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
      `INSERT INTO guardian_contacts (user_id, parent_name, parent_phone, parent_email, updated_at)
       VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         parent_name=EXCLUDED.parent_name,
         parent_phone=EXCLUDED.parent_phone,
         parent_email=EXCLUDED.parent_email,
         updated_at=NOW()`,
      [req.user.id, parent_name, parent_phone, parent_email]
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

module.exports = { getProfile, upsertProfile };
