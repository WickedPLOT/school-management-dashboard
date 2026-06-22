const crypto = require('crypto');
const pool = require('../config/db');
const { getAppSettings } = require('../services/settingsService');
const { sendTransactionalEmail } = require('../services/communicationService');

function getFrontendBaseUrl(req) {
  return req.headers.origin || process.env.FRONTEND_URL || 'http://localhost:3000';
}

// POST /api/admin/invite/single — one link, no email required
async function generateSingleInvite(req, res) {
  try {
    const maxUses = parseInt(req.body.max_uses) || 1;
    const token = crypto.randomBytes(32).toString('hex');
    const settings = await getAppSettings();
    const expiryDays = Number(settings.registration_invite_expiry_days || 7);
    const expires_at = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
    await pool.query(
      'INSERT INTO invite_tokens (token, created_by, expires_at, max_uses) VALUES (?,?,?,?)',
      [token, req.user.id, expires_at, Math.max(1, maxUses)]
    );
    const baseUrl = getFrontendBaseUrl(req);
    res.json({ link: `${baseUrl}/register?token=${token}`, expires_at, max_uses: Math.max(1, maxUses) });
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

  const baseUrl = getFrontendBaseUrl(req);
  const settings = await getAppSettings();
  const expiryDays = Number(settings.registration_invite_expiry_days || 7);
  const expires_at = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

  const maxUses = parseInt(req.body.max_uses) || 1;
  try {
    const results = await Promise.all(
      emails.map(async (email) => {
        const token = crypto.randomBytes(32).toString('hex');
        await pool.query(
      'INSERT INTO invite_tokens (token, created_by, expires_at, max_uses) VALUES (?,?,?,?)',
          [token, req.user.id, expires_at, Math.max(1, maxUses)]
        );
        const link = `${baseUrl}/register?token=${token}`;

        await sendTransactionalEmail({
          email,
          subject: 'Centre of Suffa Registration Invitation',
          message: [
            'You have been invited to register on the Centre of Suffa platform.',
            '',
            `Registration link: ${link}`,
            '',
            `This link expires on ${expires_at.toLocaleString('en-GB')}.`,
          ].join('\n'),
          purpose: 'registration-invite',
        });

        return { email, link, emailed: true };
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
    const [rows] = await pool.query(
      `SELECT t.id, t.token, t.used, t.max_uses, t.expires_at, t.created_at, u.email AS created_by_email
       FROM invite_tokens t
       LEFT JOIN users u ON u.id = t.created_by
       ORDER BY t.created_at DESC LIMIT 50`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { generateSingleInvite, generateInvite, listInvites };
