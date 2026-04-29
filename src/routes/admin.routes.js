const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { resolveTenant, requireTenant } = require('../middlewares/tenant.middleware');
const { validate, validateQuery } = require('../middlewares/validate.middleware');
const {
  createComplexSchema,
  createBuildingSchema,
  createUnitSchema,
  updateUnitStatusSchema,
  assignUserToUnitSchema,
  updateUserRoleSchema,
  listUsersQuerySchema,
} = require('../validators/admin.validator');

// All routes require authentication and admin/super_admin privileges
router.use(requireAuth);
router.use(requireRole(['admin', 'super_admin']));
router.use(resolveTenant);

router.get('/dashboard/stats', adminController.getDashboardStats);
router.get('/payment-status', adminController.getPaymentStatus);
router.get('/analytics/trends', adminController.getAnalyticsTrends);

// Users
router.get('/users', validateQuery(listUsersQuerySchema), adminController.listUsers);
router.get('/users/:id', adminController.getUserDetail);
router.patch('/users/:id', validate(updateUserRoleSchema), adminController.updateUserRole);

// Properties (Complex, Building, Units)
router.post('/complexes', validate(createComplexSchema), adminController.createComplex);
router.post('/buildings', validate(createBuildingSchema), adminController.createBuilding);

router.post('/units', validate(createUnitSchema), adminController.createUnit);
router.get('/units', adminController.listUnits);
router.patch('/units/:id', validate(updateUnitStatusSchema), adminController.updateUnitStatus);
router.post('/units/:id/assign', validate(assignUserToUnitSchema), adminController.assignUserToUnit);

module.exports = router;
