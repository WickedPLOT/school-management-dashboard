const crypto = require('crypto');
const nodemailer = require('nodemailer');
const createAfricasTalking = require('africastalking');
const pool = require('../config/db');

function normalizePhone(phone) {
  if (!phone) return null;
  const trimmed = String(phone).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return trimmed;
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('254')) return `+${digits}`;
  if (digits.startsWith('0')) return `+254${digits.slice(1)}`;
  return `+${digits}`;
}

function buildAfricasTalkingClient(settings) {
  if (settings.sms_provider !== 'africastalking') {
    throw new Error('Unsupported SMS provider');
  }
  if (!settings.at_username || !settings.at_api_key) {
    throw new Error("Africa's Talking settings are incomplete");
  }

  const credentials = {
    username: settings.at_use_sandbox ? 'sandbox' : settings.at_username,
    apiKey: settings.at_api_key,
  };

  return createAfricasTalking(credentials);
}

function parseBalanceValue(rawBalance, fallbackCurrency = 'KES') {
  if (rawBalance == null) return { amount: null, currency: fallbackCurrency, raw: null };

  const raw = String(rawBalance).trim();
  const match = raw.match(/^([A-Z]{3})\s+(-?[\d,.]+)$/i);
  if (match) {
    return {
      currency: match[1].toUpperCase(),
      amount: Number(match[2].replace(/,/g, '')),
      raw,
    };
  }

  const numeric = Number(raw.replace(/,/g, ''));
  if (Number.isFinite(numeric)) {
    return {
      currency: fallbackCurrency,
      amount: numeric,
      raw,
    };
  }

  return { amount: null, currency: fallbackCurrency, raw };
}

async function attachLiveBalance(settings) {
  const response = {
    ...settings,
    live_balance: null,
    live_balance_currency: settings.at_balance_currency || 'KES',
    live_balance_raw: null,
    live_balance_source: 'unavailable',
    live_balance_error: null,
  };

  if (!settings.at_username || !settings.at_api_key) {
    if (settings.at_credit_balance != null) {
      response.live_balance = Number(settings.at_credit_balance);
      response.live_balance_source = 'cached';
    }
    return response;
  }

  try {
    const application = buildAfricasTalkingClient(settings).APPLICATION;
    const appData = await application.fetchApplicationData();
    const rawBalance = appData?.UserData?.balance ?? appData?.balance ?? null;
    const parsed = parseBalanceValue(rawBalance, settings.at_balance_currency || 'KES');

    response.live_balance = parsed.amount;
    response.live_balance_currency = parsed.currency;
    response.live_balance_raw = parsed.raw;
    response.live_balance_source = parsed.amount == null ? 'provider-unparsed' : 'provider';

    if (parsed.amount == null && settings.at_credit_balance != null) {
      response.live_balance = Number(settings.at_credit_balance);
      response.live_balance_source = 'cached';
    }
  } catch (err) {
    response.live_balance_error = err instanceof Error ? err.message : 'Could not fetch wallet balance';
    if (settings.at_credit_balance != null) {
      response.live_balance = Number(settings.at_credit_balance);
      response.live_balance_source = 'cached';
    }
  }

  return response;
}

async function getCommunicationSettings() {
  const [rows] = await pool.query('SELECT * FROM communication_settings WHERE id=?', [1]);
  return attachLiveBalance(rows[0]);
}

async function updateCommunicationSettings(payload, userId) {
  const fields = [
    'sms_enabled', 'sms_provider', 'at_username', 'at_api_key', 'at_sender_id', 'at_use_sandbox',
    'at_paybill_number', 'at_wallet_reference', 'at_balance_currency', 'at_credit_balance', 'at_topup_notes',
    'email_enabled', 'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass',
    'smtp_from_name', 'smtp_from_email',
  ];

  const updates = [];
  const values = [];

  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      updates.push(`${field}=?`);
      values.push(payload[field]);
    }
  }

  updates.push('updated_by=?');
  values.push(userId);
  updates.push('updated_at=NOW()');

  await pool.query(
    `UPDATE communication_settings SET ${updates.join(', ')} WHERE id=?`,
    [...values, 1]
  );

  const [rows] = await pool.query('SELECT * FROM communication_settings WHERE id=?', [1]);
  return attachLiveBalance(rows[0]);
}

function buildEmailTransport(settings) {
  if (!settings.email_enabled) {
    throw new Error('Email delivery is disabled in communication settings');
  }
  if (!settings.smtp_host || !settings.smtp_port || !settings.smtp_user || !settings.smtp_pass || !settings.smtp_from_email) {
    throw new Error('SMTP settings are incomplete');
  }

  return nodemailer.createTransport({
    host: settings.smtp_host,
    port: Number(settings.smtp_port),
    secure: Boolean(settings.smtp_secure),
    auth: {
      user: settings.smtp_user,
      pass: settings.smtp_pass,
    },
  });
}

function buildSmsClient(settings) {
  if (!settings.sms_enabled) {
    throw new Error('SMS delivery is disabled in communication settings');
  }

  return buildAfricasTalkingClient(settings).SMS;
}

async function sendEmail(settings, recipient, subject, message, purpose = 'official communication') {
  const transporter = buildEmailTransport(settings);
  const fromName = settings.smtp_from_name || 'Centre of Suffa';
  const subjectLine = subject || 'Centre of Suffa Notification';
  const info = await transporter.sendMail({
    from: `"${fromName}" <${settings.smtp_from_email}>`,
    to: recipient.email,
    subject: subjectLine,
    text: message,
    html: `<p>${message.replace(/\n/g, '<br />')}</p>`,
    headers: {
      'X-Hayrat-Purpose': purpose,
    },
  });

  return { externalId: info.messageId || null };
}

async function sendTransactionalEmail(payload) {
  const settings = await getCommunicationSettings();
  return sendEmail(
    settings,
    { email: payload.email, name: payload.name || payload.email },
    payload.subject,
    payload.message,
    payload.purpose || 'official communication'
  );
}

async function sendSms(settings, recipient, message) {
  const sms = buildSmsClient(settings);
  const to = normalizePhone(recipient.phone);
  if (!to) throw new Error('Recipient phone is missing or invalid');

  const options = {
    to: [to],
    message,
    enqueue: true,
  };

  if (settings.at_sender_id) {
    options.senderId = settings.at_sender_id;
  }

  const response = await sms.send(options);
  const firstMessage = response?.SMSMessageData?.Recipients?.[0];

  if (firstMessage?.status && !String(firstMessage.status).toLowerCase().includes('success')) {
    throw new Error(firstMessage.status);
  }

  return { externalId: firstMessage?.messageId || firstMessage?.message_id || null };
}

function sectionFilter(req, alias = 'u') {
  if (req.user.role === 'super_admin') return { clause: '', params: [], scope: 'all' };
  return { clause: ` AND ${alias}.section=?`, params: [req.user.section], scope: req.user.section };
}

async function getAudienceSummary(req) {
  const { clause, params } = sectionFilter(req);
  const [rows] = await pool.query(
    `SELECT
     COUNT(*) FILTER (WHERE u.role='student' AND u.status='approved') AS total_students,
     COUNT(*) FILTER (WHERE u.role='student' AND u.status='approved' AND COALESCE(NULLIF(p.phone, ''), '') <> '') AS sms_students,
     COUNT(*) FILTER (WHERE u.role='student' AND u.status='approved' AND COALESCE(NULLIF(u.email, ''), '') <> '') AS email_students,
      COUNT(*) FILTER (WHERE u.role='student' AND u.status='approved' AND COALESCE(NULLIF(g.parent_phone, ''), '') <> '') AS sms_parents,
      COUNT(*) FILTER (WHERE u.role='student' AND u.status='approved' AND COALESCE(NULLIF(g.parent_email, ''), '') <> '') AS email_parents
     FROM users u
     LEFT JOIN profiles p ON p.user_id=u.id
     LEFT JOIN guardian_contacts g ON g.user_id=u.id
     WHERE u.role='student'${clause}`,
    params
  );
  return rows[0];
}

async function listMessageHistory(req) {
  const { clause, params } = sectionFilter(req, 'creator');
  const [rows] = await pool.query(
    `SELECT b.*, creator.email AS created_by_email
     FROM message_broadcasts b
     LEFT JOIN users creator ON creator.id = b.created_by
     WHERE 1=1${clause}
     ORDER BY b.created_at DESC
     LIMIT 50`,
    params
  );
  return rows;
}

async function sendDirectMessage(req, payload) {
  const settings = await getCommunicationSettings();
  const recipientUserId = Number(payload.recipientUserId);
  const recipientType = payload.recipientType;
  const channel = payload.channel;
  const subject = payload.subject?.trim() || null;
  const message = payload.message?.trim();

  if (!recipientUserId) throw new Error('Recipient is required');
  if (!['student', 'parent'].includes(recipientType)) throw new Error('Invalid recipient type');
  if (!message) throw new Error('Message body is required');
  if (!['sms', 'email', 'both'].includes(channel)) throw new Error('Invalid channel');
  if ((channel === 'email' || channel === 'both') && !subject) throw new Error('Email subject is required');

  const { clause, params, scope } = sectionFilter(req);
  const [rows] = await pool.query(
    `SELECT u.id AS user_id, u.email, u.section, p.full_name, p.phone, g.parent_name, g.parent_phone, g.parent_email
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN guardian_contacts g ON g.user_id = u.id
     WHERE u.role='student' AND u.status='approved' AND u.id=?${clause}`,
    [recipientUserId, ...params]
  );

  if (!rows.length) throw new Error('Recipient not found');

  const row = rows[0];
  const recipient = recipientType === 'student'
    ? { userId: row.user_id, name: row.full_name || row.email, email: row.email, phone: row.phone }
    : { userId: row.user_id, name: row.parent_name || `Parent of ${row.full_name || row.email}`, email: row.parent_email, phone: row.parent_phone };

  const audience = recipientType === 'student' ? 'students' : 'parents';
  const [insertResult] = await pool.query(
    `INSERT INTO message_broadcasts (audience, channel, section_scope, subject, message, created_by)
     VALUES (?,?,?,?,?,?)`,
    [audience, channel, scope, subject, message, req.user.id]
  );
  const [broadcastRows] = await pool.query('SELECT * FROM message_broadcasts WHERE id=?', [insertResult.insertId]);
  const broadcast = broadcastRows[0];

  let successCount = 0;
  let failureCount = 0;
  const desiredChannels = channel === 'both' ? ['email', 'sms'] : [channel];

  for (const desiredChannel of desiredChannels) {
    const delivery = {
      broadcast_id: broadcast.id,
      user_id: recipient.userId,
      recipient_type: recipientType,
      channel: desiredChannel,
      provider: desiredChannel === 'sms' ? 'africastalking' : 'smtp',
      recipient_name: recipient.name,
      recipient_email: recipient.email || null,
      recipient_phone: normalizePhone(recipient.phone),
    };

    try {
      let externalId = null;
      if (desiredChannel === 'email') {
        if (!recipient.email) throw new Error('Recipient email is missing');
        const result = await sendEmail(settings, recipient, subject, message);
        externalId = result.externalId;
      } else {
        if (!recipient.phone) throw new Error('Recipient phone is missing');
        const result = await sendSms(settings, recipient, message);
        externalId = result.externalId;
      }

      successCount += 1;
      await pool.query(
        `INSERT INTO message_deliveries
          (broadcast_id, user_id, recipient_type, channel, provider, recipient_name, recipient_email, recipient_phone, external_id, status)
         VALUES (?,?,?,?,?,?,?,?,?,'sent')`,
        [
          delivery.broadcast_id,
          delivery.user_id,
          delivery.recipient_type,
          delivery.channel,
          delivery.provider,
          delivery.recipient_name,
          delivery.recipient_email,
          delivery.recipient_phone,
          externalId,
        ]
      );
    } catch (err) {
      failureCount += 1;
      await pool.query(
        `INSERT INTO message_deliveries
          (broadcast_id, user_id, recipient_type, channel, provider, recipient_name, recipient_email, recipient_phone, status, error_message)
         VALUES (?,?,?,?,?,?,?,?,'failed',?)`,
        [
          delivery.broadcast_id,
          delivery.user_id,
          delivery.recipient_type,
          delivery.channel,
          delivery.provider,
          delivery.recipient_name,
          delivery.recipient_email,
          delivery.recipient_phone,
          err instanceof Error ? err.message : 'Delivery failed',
        ]
      );
    }
  }

  const status = successCount === 0 ? 'failed' : failureCount > 0 ? 'partial' : 'sent';
  await pool.query(
    `UPDATE message_broadcasts
     SET recipient_count=?, success_count=?, failure_count=?, status=?
     WHERE id=?`,
    [1, successCount, failureCount, status, broadcast.id]
  );
  const [updatedRows] = await pool.query('SELECT * FROM message_broadcasts WHERE id=?', [broadcast.id]);
  return updatedRows[0];
}

async function sendBroadcast(req, payload) {
  const settings = await getCommunicationSettings();
  const channel = payload.channel;
  const audience = payload.audience;
  const subject = payload.subject?.trim() || null;
  const message = payload.message?.trim();

  if (!message) throw new Error('Message body is required');
  if (!['students', 'parents', 'both'].includes(audience)) throw new Error('Invalid audience');
  if (!['sms', 'email', 'both'].includes(channel)) throw new Error('Invalid channel');
  if ((channel === 'email' || channel === 'both') && !subject) throw new Error('Email subject is required');

  const { clause, params, scope } = sectionFilter(req);
  const [recipientsRows] = await pool.query(
    `SELECT u.id AS user_id, u.email, u.section, p.full_name, p.phone, g.parent_name, g.parent_phone, g.parent_email
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     LEFT JOIN guardian_contacts g ON g.user_id = u.id
     WHERE u.role='student' AND u.status='approved'${clause}
     ORDER BY p.full_name ASC NULLS LAST, u.id ASC`,
    params
  );

  const recipientEntries = [];
  for (const row of recipientsRows) {
    if (audience === 'students' || audience === 'both') {
      recipientEntries.push({
        userId: row.user_id,
        name: row.full_name || row.email,
        recipientType: 'student',
        email: row.email,
        phone: row.phone,
      });
    }
    if (audience === 'parents' || audience === 'both') {
      recipientEntries.push({
        userId: row.user_id,
        name: row.parent_name || `Parent of ${row.full_name || row.email}`,
        recipientType: 'parent',
        email: row.parent_email,
        phone: row.parent_phone,
      });
    }
  }

  const [insertResult] = await pool.query(
    `INSERT INTO message_broadcasts (audience, channel, section_scope, subject, message, created_by)
     VALUES (?,?,?,?,?,?)`,
    [audience, channel, scope, subject, message, req.user.id]
  );
  const [broadcastRows] = await pool.query('SELECT * FROM message_broadcasts WHERE id=?', [insertResult.insertId]);
  const broadcast = broadcastRows[0];

  let successCount = 0;
  let failureCount = 0;

  for (const recipient of recipientEntries) {
    const desiredChannels = channel === 'both' ? ['email', 'sms'] : [channel];

    for (const desiredChannel of desiredChannels) {
      const delivery = {
        broadcast_id: broadcast.id,
        user_id: recipient.userId,
        recipient_type: recipient.recipientType,
        channel: desiredChannel,
        provider: desiredChannel === 'sms' ? 'africastalking' : 'smtp',
        recipient_name: recipient.name,
        recipient_email: recipient.email || null,
        recipient_phone: normalizePhone(recipient.phone),
      };

      try {
        let externalId = null;

        if (desiredChannel === 'email') {
          if (!recipient.email) throw new Error('Recipient email is missing');
          const result = await sendEmail(settings, recipient, subject, message);
          externalId = result.externalId;
        } else {
          if (!recipient.phone) throw new Error('Recipient phone is missing');
          const result = await sendSms(settings, recipient, message);
          externalId = result.externalId;
        }

        successCount += 1;
        await pool.query(
          `INSERT INTO message_deliveries
            (broadcast_id, user_id, recipient_type, channel, provider, recipient_name, recipient_email, recipient_phone, external_id, status)
           VALUES (?,?,?,?,?,?,?,?,?,'sent')`,
          [
            delivery.broadcast_id,
            delivery.user_id,
            delivery.recipient_type,
            delivery.channel,
            delivery.provider,
            delivery.recipient_name,
            delivery.recipient_email,
            delivery.recipient_phone,
            externalId,
          ]
        );
      } catch (err) {
        failureCount += 1;
        await pool.query(
          `INSERT INTO message_deliveries
            (broadcast_id, user_id, recipient_type, channel, provider, recipient_name, recipient_email, recipient_phone, status, error_message)
           VALUES (?,?,?,?,?,?,?,?,'failed',?)`,
          [
            delivery.broadcast_id,
            delivery.user_id,
            delivery.recipient_type,
            delivery.channel,
            delivery.provider,
            delivery.recipient_name,
            delivery.recipient_email,
            delivery.recipient_phone,
            err instanceof Error ? err.message : 'Delivery failed',
          ]
        );
      }
    }
  }

  const recipientCount = recipientEntries.length;
  const status = successCount === 0 ? 'failed' : failureCount > 0 ? 'partial' : 'sent';
  await pool.query(
    `UPDATE message_broadcasts
     SET recipient_count=?, success_count=?, failure_count=?, status=?
     WHERE id=?`,
    [recipientCount, successCount, failureCount, status, broadcast.id]
  );
  const [updatedRows] = await pool.query('SELECT * FROM message_broadcasts WHERE id=?', [broadcast.id]);
  return updatedRows[0];
}

async function issueVerificationCode(email, purpose) {
  const settings = await getCommunicationSettings();
  const code = String(crypto.randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await pool.query(
    `INSERT INTO verification_codes (email, purpose, code, expires_at)
     VALUES (?,?,?,?)`,
    [email, purpose, code, expiresAt]
  );

  await sendEmail(
    settings,
    { email, name: email },
    `Your Centre of Suffa ${purpose} code`,
    `Your verification code is ${code}. It expires in 10 minutes.`,
    'verification-code'
  );

  return { expiresAt };
}

async function verifyCode(email, purpose, code) {
  const [rows] = await pool.query(
    `SELECT * FROM verification_codes
     WHERE email=? AND purpose=? AND code=? AND consumed_at IS NULL AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose, code]
  );

  if (!rows.length) return false;

  await pool.query(
    `UPDATE verification_codes
     SET consumed_at=NOW()
     WHERE id=?`,
    [rows[0].id]
  );

  return true;
}

module.exports = {
  getCommunicationSettings,
  updateCommunicationSettings,
  getAudienceSummary,
  listMessageHistory,
  sendBroadcast,
  sendDirectMessage,
  sendTransactionalEmail,
  issueVerificationCode,
  verifyCode,
  normalizePhone,
};
