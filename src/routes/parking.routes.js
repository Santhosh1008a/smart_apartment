const express = require('express');
const router = express.Router();
const parkingController = require('../controllers/parking.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const { validate, validateQuery } = require('../middlewares/validate.middleware');
const {
  createSlotSchema,
  updateSlotSchema,
  slotQuerySchema,
  createVehicleSchema,
  assignSlotSchema,
  createRequestSchema,
  reviewRequestSchema,
  requestQuerySchema,
  listVehiclesQuerySchema,
  createVisitorSessionSchema,
  visitorSessionQuerySchema,
  verifyVehicleQuerySchema,
} = require('../validators/parking.validator');

router.use(requireAuth);
router.use(resolveTenant);
router.use(requireTenant);

// Resident parking
router.get('/my', requireRole(['resident', 'tenant']), parkingController.getMyParking);
router.post('/vehicles', requireRole(['resident', 'tenant']), validate(createVehicleSchema), parkingController.createVehicle);
router.post('/requests', requireRole(['resident', 'tenant']), validate(createRequestSchema), parkingController.createRequest);

// Security checkpoint
router.get('/security/verify', requireRole(['security', 'admin', 'super_admin']), validateQuery(verifyVehicleQuerySchema), parkingController.verifyVehicle);
router.get('/security/slots', requireRole(['security', 'admin', 'super_admin']), validateQuery(slotQuerySchema), parkingController.listSlots);
router.get('/security/visitor-sessions', requireRole(['security', 'admin', 'super_admin']), validateQuery(visitorSessionQuerySchema), parkingController.listVisitorSessions);
router.post('/security/visitor-sessions', requireRole(['security', 'admin', 'super_admin']), validate(createVisitorSessionSchema), parkingController.createVisitorSession);
router.patch('/security/visitor-sessions/:id/release', requireRole(['security', 'admin', 'super_admin']), parkingController.releaseVisitorSession);

// Admin parking management
router.get('/admin/overview', requireRole(['admin', 'super_admin']), parkingController.getAdminOverview);
router.get('/admin/slots', requireRole(['admin', 'super_admin']), validateQuery(slotQuerySchema), parkingController.listSlots);
router.post('/admin/slots', requireRole(['admin', 'super_admin']), validate(createSlotSchema), parkingController.createSlot);
router.patch('/admin/slots/:id', requireRole(['admin', 'super_admin']), validate(updateSlotSchema), parkingController.updateSlot);
router.get('/admin/vehicles', requireRole(['admin', 'super_admin']), validateQuery(listVehiclesQuerySchema), parkingController.listVehicles);
router.post('/admin/assignments', requireRole(['admin', 'super_admin']), validate(assignSlotSchema), parkingController.assignSlot);
router.patch('/admin/assignments/:id/release', requireRole(['admin', 'super_admin']), parkingController.releaseAssignment);
router.get('/admin/requests', requireRole(['admin', 'super_admin']), validateQuery(requestQuerySchema), parkingController.listRequests);
router.patch('/admin/requests/:id', requireRole(['admin', 'super_admin']), validate(reviewRequestSchema), parkingController.reviewRequest);
router.get('/admin/visitor-sessions', requireRole(['admin', 'super_admin']), validateQuery(visitorSessionQuerySchema), parkingController.listVisitorSessions);
router.post('/admin/visitor-sessions', requireRole(['admin', 'super_admin']), validate(createVisitorSessionSchema), parkingController.createVisitorSession);
router.patch('/admin/visitor-sessions/:id/release', requireRole(['admin', 'super_admin']), parkingController.releaseVisitorSession);

module.exports = router;
