const { query } = require('../config/db');

/**
 * Resolves the authenticated user's complex_id from their unit assignment.
 * Sets req.complexId for use in all downstream queries.
 * 
 * If the user has no assigned unit (e.g., super_admin), req.complexId = null.
 * Controllers should handle null complexId gracefully (super_admins may see all data).
 */
const resolveTenant = async (req, res, next) => {
  try {
    // Skip tenant resolution if user is not authenticated yet
    if (!req.user) {
      return next();
    }

    // Super admins can optionally scope to a complex via query param
    if (req.user.role === 'super_admin') {
      req.complexId = req.query.complex_id || null;
      return next();
    }

    // Admins and other roles now have complex_id directly on the user record.
    req.complexId = req.user.complex_id || null;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware that enforces tenant isolation — rejects requests where
 * complexId could not be resolved (user not assigned to any unit).
 * Apply this on routes that REQUIRE complex scoping.
 */
const requireTenant = (req, res, next) => {
  // Ensure req.complexId is populated
  if (!req.complexId && req.user && req.user.complex_id) {
    req.complexId = req.user.complex_id;
  }

  if (!req.complexId) {
    return res.status(403).json({
      success: false,
      message: 'You must be assigned to a unit/complex to access this resource',
    });
  }
  next();
};

// Apartment admins must always be bound to one tenant. Super admins may use
// global routes or explicitly scope themselves with complex_id.
const requireTenantForAdmins = (req, res, next) => {
  if (req.user?.role === 'admin' && !req.complexId) {
    return res.status(403).json({
      success: false,
      message: 'Apartment administrators must be assigned to a complex',
    });
  }
  next();
};

module.exports = { resolveTenant, requireTenant, requireTenantForAdmins };
