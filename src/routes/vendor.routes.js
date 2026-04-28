const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { requireTenant } = require('../middlewares/tenant.middleware');

// All vendor routes require auth + vendor role + tenant isolation
router.use(requireAuth);
router.use(requireRole(['vendor']));
router.use(requireTenant);

router.get('/requests', vendorController.getMyRequests);
router.get('/requests/completed', vendorController.getCompletedRequests);
router.get('/dashboard/stats', vendorController.getDashboardStats);
router.patch('/requests/:id', vendorController.updateRequestStatus);

module.exports = router;
