require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '35mb' }));

const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const studentRoutes = require('./src/routes/student');
const profileRoutes = require('./src/routes/profile');
const paymentsRoutes = require('./src/routes/payments');

const apiRoutes = [
  ['/auth', authRoutes],
  ['/admin', adminRoutes],
  ['/student', studentRoutes],
  ['/profile', profileRoutes],
  ['/payments', paymentsRoutes],
];

for (const [path, router] of apiRoutes) {
  app.use('/api' + path, router);
  app.use(path, router);
}

app.get('/api/health', (_, res) => res.json({ ok: true }));
app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

async function start() {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server', err);
    process.exit(1);
  });
}

module.exports = app;
