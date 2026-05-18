const fs = require('fs/promises');
const path = require('path');
const pool = require('./db');

async function ensureSchema() {
  const schemaPath = path.resolve(__dirname, '../../../database/schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  await pool.query(sql);
}

module.exports = { ensureSchema };
