const express = require('express');
const router = express.Router();
const noticeController = require('../controllers/notice.controller');
const { requireAuth, requireRole } = require('../middlewares/auth.middleware');
const { validate, validateParams } = require('../middlewares/validate.middleware');
const {
  createNoticeSchema,
  updateNoticeSchema,
  noticeIdParamsSchema,
} = require('../validators/notice.validator');

router.use(requireAuth);
router.get('/', requireRole(['admin', 'resident', 'tenant']), noticeController.listNotices);
router.post('/', requireRole(['admin']), validate(createNoticeSchema), noticeController.createNotice);
router.get('/:id', requireRole(['admin', 'resident', 'tenant']), validateParams(noticeIdParamsSchema), noticeController.getNotice);
router.patch('/:id', requireRole(['admin']), validateParams(noticeIdParamsSchema), validate(updateNoticeSchema), noticeController.updateNotice);
router.post('/:id/send', requireRole(['admin']), validateParams(noticeIdParamsSchema), noticeController.sendNotice);
router.post('/:id/cancel', requireRole(['admin']), validateParams(noticeIdParamsSchema), noticeController.cancelNotice);
router.patch('/:id/read', requireRole(['resident', 'tenant']), validateParams(noticeIdParamsSchema), noticeController.markNoticeRead);

module.exports = router;
