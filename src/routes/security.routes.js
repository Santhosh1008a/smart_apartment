const express = require('express');
const router = express.Router();
const securityController = require('../controllers/security.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { requireTenant } = require('../middlewares/tenant.middleware');

// All security routes require auth + security role + tenant isolation
router.use(requireAuth);
router.use(requireRole(['security']));
router.use(requireTenant);

router.get('/visitors/today', securityController.getVisitorsToday);
router.get('/dashboard/stats', securityController.getDashboardStats);
router.post('/visitor/:id/checkin', securityController.checkinVisitor);
router.post('/visitor/:id/checkout', securityController.checkoutVisitor);

module.exports = router;
