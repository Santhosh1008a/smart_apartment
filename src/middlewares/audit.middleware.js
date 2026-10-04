const auditLogger = require('../utils/auditLogger');

exports.auditLog = (actionName) => {
  return (req, res, next) => {
    res.on('finish', () => {
      // Only log successful mutative actions (POST/PUT/DELETE)
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode >= 200 && res.statusCode < 400) {
        auditLogger.info({
          action: actionName || req.route?.path || req.path,
          userId: req.user ? req.user.id : 'anonymous',
          userRole: req.user ? req.user.role : 'none',
          method: req.method,
          path: req.route?.path || req.path,
          statusCode: res.statusCode,
        });
      }
    });
    next();
  };
};
