const axios = require('axios');

function getConfig() {
  const env = process.env.MPESA_ENV || 'sandbox';
  const baseUrl = env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  return {
    env,
    baseUrl,
    consumerKey: process.env.MPESA_CONSUMER_KEY,
    consumerSecret: process.env.MPESA_CONSUMER_SECRET,
    shortcode: process.env.MPESA_SHORTCODE,
    passkey: process.env.MPESA_PASSKEY,
    callbackUrl: process.env.MPESA_CALLBACK_URL,
    transactionType: process.env.MPESA_TRANSACTION_TYPE || 'CustomerPayBillOnline',
  };
}

function assertConfigured(config) {
  const missing = Object.entries({
    MPESA_CONSUMER_KEY: config.consumerKey,
    MPESA_CONSUMER_SECRET: config.consumerSecret,
    MPESA_SHORTCODE: config.shortcode,
    MPESA_PASSKEY: config.passkey,
    MPESA_CALLBACK_URL: config.callbackUrl,
  }).filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) {
    const error = new Error(`M-Pesa STK Push is not configured. Missing: ${missing.join(', ')}`);
    error.statusCode = 503;
    throw error;
  }
}

function normalizePhone(phone) {
  const cleaned = String(phone || '').replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+254')) return cleaned.slice(1);
  if (cleaned.startsWith('254')) return cleaned;
  if (cleaned.startsWith('0')) return `254${cleaned.slice(1)}`;
  if (cleaned.length === 9) return `254${cleaned}`;
  return cleaned;
}

function timestamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

async function getAccessToken(config = getConfig()) {
  assertConfigured(config);
  const auth = Buffer.from(`${config.consumerKey}:${config.consumerSecret}`).toString('base64');
  const response = await axios.get(`${config.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.data.access_token;
}

async function initiateStkPush({ phone, amount, accountReference, transactionDesc }) {
  const config = getConfig();
  assertConfigured(config);
  const token = await getAccessToken(config);
  const time = timestamp();
  const password = Buffer.from(`${config.shortcode}${config.passkey}${time}`).toString('base64');
  const payload = {
    BusinessShortCode: config.shortcode,
    Password: password,
    Timestamp: time,
    TransactionType: config.transactionType,
    Amount: Math.ceil(Number(amount)),
    PartyA: normalizePhone(phone),
    PartyB: config.shortcode,
    PhoneNumber: normalizePhone(phone),
    CallBackURL: config.callbackUrl,
    AccountReference: String(accountReference || 'Centre of Suffa').slice(0, 12),
    TransactionDesc: String(transactionDesc || 'Centre of Suffa fee payment').slice(0, 100),
  };
  const response = await axios.post(`${config.baseUrl}/mpesa/stkpush/v1/processrequest`, payload, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  return response.data;
}

module.exports = { getConfig, normalizePhone, initiateStkPush };
