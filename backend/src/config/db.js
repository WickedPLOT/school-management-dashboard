const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'da31.host-ww.net',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'hayratke_hayratDB',
  password: process.env.DB_PASSWORD || 'qHLyhZU5LWyJAttgpeKC',
  database: process.env.DB_NAME || 'hayratke_hayratDB',
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

module.exports = pool;
