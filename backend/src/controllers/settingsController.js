const { getAppSettings, getPublicSettings, updateAppSettings } = require('../services/settingsService');

async function getSettings(req, res) {
  try {
    const settings = await getAppSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function saveSettings(req, res) {
  try {
    const settings = await updateAppSettings(req.body, req.user.id);
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getPublic(req, res) {
  try {
    const settings = await getPublicSettings();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getSettings, saveSettings, getPublic };
