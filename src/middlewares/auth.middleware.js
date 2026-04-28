const { verifyAccessToken } = require('../utils/jwt');
const { query } = require('../config/db');

exports.requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyAccessToken(token);

    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }

    // Verify user still exists and is active
    const { rows } = await query('SELECT id, role, is_active, complex_id, vendor_category FROM users WHERE id = $1', [decoded.id]);
    if (rows.length === 0 || !rows[0].is_active) {
      return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    }

    req.user = rows[0];
    next();
  } catch (error) {
    next(error);
  }
};

exports.requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: Insufficient privileges' });
    }
    next();
  };
};
