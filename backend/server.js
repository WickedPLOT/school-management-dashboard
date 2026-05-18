require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ensureSchema } = require('./src/config/bootstrap');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/admin', require('./src/routes/admin'));
app.use('/api/profile', require('./src/routes/profile'));

app.get('/api/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;

async function start() {
  await ensureSchema();
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
