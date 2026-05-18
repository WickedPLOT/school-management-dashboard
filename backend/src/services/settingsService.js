const pool = require('../config/db');

async function getAppSettings() {
  const result = await pool.query('SELECT * FROM app_settings WHERE id=1');
  return result.rows[0];
}

async function getPublicSettings() {
  const result = await pool.query(
    `SELECT centre_name, platform_label, support_email, approval_required, allow_student_profile_edits
     FROM app_settings WHERE id=1`
  );
  return result.rows[0];
}

async function updateAppSettings(payload, userId) {
  const fields = [
    'centre_name',
    'platform_label',
    'support_email',
    'registration_invite_expiry_days',
    'approval_required',
    'allow_student_profile_edits',
    'attendance_late_weight',
    'attendance_warning_threshold',
    'default_event_section_scope',
  ];

  const updates = [];
  const values = [];
  let position = 1;

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updates.push(`${field}=$${position++}`);
      values.push(payload[field]);
    }
  }

  updates.push(`updated_by=$${position++}`);
  values.push(userId);
  updates.push(`updated_at=NOW()`);
  values.push(1);

  const result = await pool.query(
    `UPDATE app_settings SET ${updates.join(', ')} WHERE id=$${position} RETURNING *`,
    values
  );

  return result.rows[0];
}

module.exports = { getAppSettings, getPublicSettings, updateAppSettings };
