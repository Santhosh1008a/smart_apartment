const visitorService = require('../services/visitor.service');

exports.createPass = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const result = await visitorService.createVisitorPass(req.body, req.user.id, io);
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
};

exports.verifyQR = async (req, res, next) => {
  try {
    const result = await visitorService.verifyVisitorQR(req.body.token, req.user.role, req.user.complex_id || null);
    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

exports.listMyPasses = async (req, res, next) => {
  try {
    const data = await visitorService.listPasses(req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.checkoutVisitor = async (req, res, next) => {
  try {
    const data = await visitorService.checkout(req.params.id, req.user.id);
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

exports.cancelPass = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    const complexId = req.user.complex_id;
    const result = await visitorService.cancel(req.params.id, userId, userRole, complexId);
    res.status(200).json({ success: true, message: 'Pass cancelled', data: result });
  } catch (err) {
    next(err);
  }
};
