const express = require('express');
const router = express.Router();
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { validate, validateQuery } = require('../middlewares/validate.middleware');
const { authLimiter } = require('../middlewares/rateLimiter.middleware');
const controller = require('../controllers/privacy.controller');
const {
  createPrivacyRequestSchema,
  updatePrivacyRequestSchema,
  privacyRequestFilterSchema,
} = require('../validators/privacy.validator');

router.use(requireAuth);
router.post('/requests', authLimiter, validate(createPrivacyRequestSchema), controller.createRequest);
router.get('/requests', controller.listMyRequests);
router.get('/requests/admin', requireRole(['super_admin']), validateQuery(privacyRequestFilterSchema), controller.listAdminRequests);
router.patch('/requests/admin/:id', requireRole(['super_admin']), validate(updatePrivacyRequestSchema), controller.updateAdminRequest);

module.exports = router;
