const express = require('express');
const router = express.Router();
const superAdminController = require('../controllers/super-admin.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');

router.use(requireAuth);
router.use(requireRole(['super_admin']));

router.get('/dashboard', superAdminController.getDashboard);
router.post('/complexes', superAdminController.createComplex);
router.post('/admins', superAdminController.createAdmin);

module.exports = router;
