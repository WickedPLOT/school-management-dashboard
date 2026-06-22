const pool = require('../config/db');

const {
  getCommunicationSettings,
  updateCommunicationSettings,
  getAudienceSummary,
  listMessageHistory,
  sendBroadcast,
  sendDirectMessage,
} = require('../services/communicationService');

async function getSettings(req, res) {
  try {
    const settings = await getCommunicationSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveSettings(req, res) {
  try {
    const settings = await updateCommunicationSettings(req.body, req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMessagingSummary(req, res) {
  try {
    const [summary, history] = await Promise.all([
      getAudienceSummary(req),
      listMessageHistory(req),
    ]);
    res.json({ summary, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getHistory(req, res) {
  try {
    const history = await listMessageHistory(req);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}



function platformScopeFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [] };
  return { clause: ` AND ${alias}.section = $1`, params: [req.user.section] };
}

function adminRolesSql() {
  return "'brothers_admin','sisters_admin','super_admin'";
}

async function listPlatformRecipients(req, res) {
  const { clause, params } = platformScopeFilter(req);
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.role, u.section, u.status, p.full_name
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.status = 'approved'
         AND (u.role = 'student' OR u.role IN (${adminRolesSql()}))${clause}
       ORDER BY CASE WHEN u.role='student' THEN 1 ELSE 0 END, u.section, COALESCE(p.full_name, u.email)`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function sendPlatformMessage(req, res) {
  const { mode = 'direct', audience = 'all', recipient_user_id, title, message } = req.body;
  const cleanTitle = title?.trim();
  const cleanMessage = message?.trim();

  if (!cleanTitle || !cleanMessage) return res.status(400).json({ error: 'Title and message are required' });
  if (!['direct', 'broadcast'].includes(mode)) return res.status(400).json({ error: 'Invalid platform message mode' });
  if (!['students', 'admins', 'all'].includes(audience)) return res.status(400).json({ error: 'Invalid platform audience' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { clause, params } = platformScopeFilter(req);
    let recipients = [];

    if (mode === 'direct') {
      const recipientId = Number(recipient_user_id);
      if (!recipientId) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Recipient is required' });
      }
      const result = await client.query(
        `SELECT u.id, u.email, u.role, u.section
         FROM users u
         WHERE u.status='approved'
           AND (u.role='student' OR u.role IN (${adminRolesSql()}))
           AND u.id = $${params.length + 1}${clause}`,
        [...params, recipientId]
      );
      recipients = result.rows;
    } else {
      const roleClause = audience === 'students'
        ? " AND u.role='student'"
        : audience === 'admins'
          ? ` AND u.role IN (${adminRolesSql()})`
          : ` AND (u.role='student' OR u.role IN (${adminRolesSql()}))`;
      const result = await client.query(
        `SELECT u.id, u.email, u.role, u.section
         FROM users u
         WHERE u.status='approved'${roleClause}${clause}`,
        params
      );
      recipients = result.rows;
    }

    if (!recipients.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No platform recipients found' });
    }

    for (const recipient of recipients) {
      await client.query(
        `INSERT INTO notifications (user_id, title, message, kind, action_url)
         VALUES ($1,$2,$3,'platform-message',$4)`,
        [
          recipient.id,
          cleanTitle,
          cleanMessage,
          recipient.role === 'student' ? '/student/notifications' : '/admin/notifications',
        ]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ status: 'sent', recipient_count: recipients.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

async function createBroadcast(req, res) {
  try {
    const result = await sendBroadcast(req, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function createDirectMessage(req, res) {
  try {
    const result = await sendDirectMessage(req, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getSettings,
  saveSettings,
  getMessagingSummary,
  getHistory,
  createBroadcast,
  createDirectMessage,
  listPlatformRecipients,
  sendPlatformMessage,
};
