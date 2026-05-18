const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { issueVerificationCode, verifyCode } = require('../services/communicationService');
const { getAppSettings } = require('../services/settingsService');

// POST /api/auth/register  (requires valid invite token)
async function register(req, res) {
  const {
    invite_token,
    email, password,
    full_name, phone, gender,
    institution, course, year_of_study, quran_level, home_county,
  } = req.body;

  if (!invite_token) return res.status(400).json({ error: 'Invite token required' });
  if (!email || !password || !full_name || !gender)
    return res.status(400).json({ error: 'email, password, full_name, gender are required' });
  if (!['male', 'female'].includes(gender))
    return res.status(400).json({ error: 'gender must be male or female' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const appSettings = await getAppSettings();

    // Validate invite token
    const inv = await client.query(
      "SELECT * FROM invite_tokens WHERE token=$1 AND used=FALSE AND expires_at > NOW()",
      [invite_token]
    );
    if (!inv.rows.length) return res.status(400).json({ error: 'Invalid or expired invite link' });

    // Check email uniqueness
    const exists = await client.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length) return res.status(409).json({ error: 'Email already registered' });

    // Gender determines section
    const section = gender === 'male' ? 'brothers' : 'sisters';
    const password_hash = await bcrypt.hash(password, 10);

    const userResult = await client.query(
      'INSERT INTO users (email, password_hash, role, section, status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [email, password_hash, 'student', section, appSettings.approval_required ? 'pending' : 'approved']
    );
    const userId = userResult.rows[0].id;

    await client.query(
      `INSERT INTO profiles (user_id, full_name, phone, gender, institution, course, year_of_study, quran_level, home_county)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [userId, full_name, phone, gender, institution, course, year_of_study || null, quran_level, home_county]
    );

    // Mark token as used
    await client.query('UPDATE invite_tokens SET used=TRUE WHERE token=$1', [invite_token]);

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
    const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
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
    const result = await pool.query(
      "SELECT id FROM invite_tokens WHERE token=$1 AND used=FALSE AND expires_at > NOW()",
      [token]
    );
    if (!result.rows.length) return res.status(400).json({ valid: false, error: 'Invalid or expired invite link' });
    res.json({ valid: true });
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
