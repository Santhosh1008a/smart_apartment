const express = require('express');
const router = express.Router();
const visitorController = require('../controllers/visitor.controller');
const { requireAuth } = require('../middlewares/auth.middleware');
const { validate } = require('../middlewares/validate.middleware');
const { createPassSchema, verifyQRSchema } = require('../validators/visitor.validator');

router.use(requireAuth);

router.get('/', visitorController.listMyPasses);
router.post('/', validate(createPassSchema), visitorController.createPass);
router.post('/verify-qr', validate(verifyQRSchema), visitorController.verifyQR);
router.post('/:id/checkout', visitorController.checkoutVisitor);
router.delete('/:id', visitorController.cancelPass);

module.exports = router;
