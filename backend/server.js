require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '35mb' }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/student', require('./src/routes/student'));
app.use('/api/profile', require('./src/routes/profile'));
app.use('/api/payments', require('./src/routes/payments'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

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
