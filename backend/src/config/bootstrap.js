const fs = require('fs/promises');
const path = require('path');
const pool = require('./db');

async function ensureSchema() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

module.exports = { ensureSchema };
