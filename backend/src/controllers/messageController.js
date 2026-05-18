const {
  getCommunicationSettings,
  updateCommunicationSettings,
  getAudienceSummary,
  listMessageHistory,
  sendBroadcast,
} = require('../services/communicationService');

async function getSettings(req, res) {
  try {
    const settings = await getCommunicationSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveSettings(req, res) {
  try {
    const settings = await updateCommunicationSettings(req.body, req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getMessagingSummary(req, res) {
  try {
    const [summary, history] = await Promise.all([
      getAudienceSummary(req),
      listMessageHistory(req),
    ]);
    res.json({ summary, history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getHistory(req, res) {
  try {
    const history = await listMessageHistory(req);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function createBroadcast(req, res) {
  try {
    const result = await sendBroadcast(req, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

module.exports = {
  getSettings,
  saveSettings,
  getMessagingSummary,
  getHistory,
  createBroadcast,
};
