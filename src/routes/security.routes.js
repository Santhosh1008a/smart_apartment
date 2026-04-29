const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { resolveTenant } = require('../middlewares/tenant.middleware');

router.use(requireAuth);
router.use(requireRole(['security', 'admin', 'super_admin']));
router.use(resolveTenant);

router.get('/visitors/today', securityController.getVisitorsToday);
router.post('/visitor/:id/checkin', securityController.checkinVisitor);
router.post('/visitor/:id/checkout', securityController.checkoutVisitor);

module.exports = router;
