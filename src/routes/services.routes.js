const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/services.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const { validate, validateQuery } = require('../middlewares/validate.middleware');
const {
  triggerEmergencySchema,
  assignParkingSchema,
  raiseVendorRequestSchema,
  listVendorsQuerySchema,
} = require('../validators/services.validator');

router.use(requireAuth);
router.use(resolveTenant);

// Emergency
router.post('/emergencies', validate(triggerEmergencySchema), servicesController.triggerEmergency);
router.get('/emergencies', requireRole(['admin', 'security', 'super_admin', 'resident']), servicesController.listEmergencies);
router.patch('/emergencies/:id', requireRole(['admin', 'security', 'super_admin', 'resident']), servicesController.resolveEmergency);

// Parking
router.get('/parking/slots', requireTenant, servicesController.listAvailableSlots);
router.get('/parking/my-assignments', requireTenant, servicesController.listMyParkingAssignments);
router.post('/admin/parking/assign', requireRole(['admin', 'super_admin']), requireTenant, validate(assignParkingSchema), servicesController.assignParking);

// Vendors
router.get('/vendors', validateQuery(listVendorsQuerySchema), servicesController.listVendors);
router.get('/vendor-requests', servicesController.listMyVendorRequests);
router.post('/vendor-requests', validate(raiseVendorRequestSchema), servicesController.raiseVendorRequest);

// Admin: all vendor requests in complex
router.get('/admin/vendor-requests', requireRole(['admin', 'super_admin']), servicesController.listAllVendorRequests);

module.exports = router;
