const router = require('express').Router();
const {
  register,
  login,
  validateInvite,
  requestEmailCode,
  verifyEmailCode,
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/validate-invite', validateInvite);
router.post('/email-code/request', requestEmailCode);
router.post('/email-code/verify', verifyEmailCode);

module.exports = router;
