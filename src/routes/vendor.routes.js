const express = require('express');
const router = express.Router();
const vendorController = require('../controllers/vendor.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { resolveTenant } = require('../middlewares/tenant.middleware');

router.use(requireAuth);
router.use(requireRole(['vendor', 'admin', 'super_admin']));
router.use(resolveTenant);

router.get('/requests', vendorController.getMyRequests);
router.patch('/requests/:id', vendorController.updateRequestStatus);

module.exports = router;
