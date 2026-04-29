const express = require('express');
const router = express.Router();
const assistantController = require('../controllers/assistant.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { resolveTenant } = require('../middlewares/tenant.middleware');
const { aiLimiter } = require('../middlewares/rateLimiter.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { assistantPromptSchema } = require('../validators/assistant.validator');

console.log('Assistant routes loaded');

router.use(requireAuth);
router.use(resolveTenant);

router.post('/chat', aiLimiter, validate(assistantPromptSchema), assistantController.chat);

module.exports = router;
