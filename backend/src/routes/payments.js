const router = require('express').Router();
const { handleMpesaCallback } = require('../controllers/feeController');

router.post('/mpesa/callback', handleMpesaCallback);

module.exports = router;
