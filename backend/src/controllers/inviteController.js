const crypto = require('crypto');
const pool = require('../config/db');
const { getAppSettings } = require('../services/settingsService');

// POST /api/admin/invite/single — one link, no email required
async function generateSingleInvite(req, res) {
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const settings = await getAppSettings();
    const expiryDays = Number(settings.registration_invite_expiry_days || 7);
    const expires_at = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO invite_tokens (token, created_by, expires_at) VALUES ($1,$2,$3)',
      [token, req.user.id, expires_at]
    );
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.json({ link: `${baseUrl}/register?token=${token}`, expires_at });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/admin/invite — bulk, requires emails array
async function generateInvite(req, res) {
  const { emails } = req.body;
  if (!emails || !Array.isArray(emails) || emails.length === 0)
    return res.status(400).json({ error: 'Provide an array of emails' });
  if (emails.length > 50)
    return res.status(400).json({ error: 'Maximum 50 emails per batch' });

  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const settings = await getAppSettings();
  const expiryDays = Number(settings.registration_invite_expiry_days || 7);
  const expires_at = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  try {
    const results = await Promise.all(
      emails.map(async (email) => {
        const token = crypto.randomBytes(32).toString('hex');
        await pool.query(
          'INSERT INTO invite_tokens (token, created_by, expires_at) VALUES ($1,$2,$3)',
          [token, req.user.id, expires_at]
        );
        return { email, link: `${baseUrl}/register?token=${token}` };
      })
    );
    res.json({ expires_at, invites: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/admin/invites
async function listInvites(req, res) {
  try {
    const result = await pool.query(
      `SELECT t.id, t.token, t.used, t.expires_at, t.created_at, u.email AS created_by_email
       FROM invite_tokens t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY t.created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { generateSingleInvite, generateInvite, listInvites };
