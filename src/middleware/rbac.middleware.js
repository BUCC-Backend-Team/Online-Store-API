const ApiError = require('../utils/apiError');
const ROLES = require('../constants/roles');

// Usage: router.post('/products', protect, authorize(ROLES.ADMIN), productController.create)
// Pass one or more allowed roles. Must run AFTER `protect` (needs req.user set).
const authorize = (...allowedRoles) => {
  // Fail fast at startup if a route was wired with a role that doesn't exist
  const validRoles = Object.values(ROLES);
  allowedRoles.forEach((role) => {
    if (!validRoles.includes(role)) {
      throw new Error(`authorize() received an unknown role: "${role}"`);
    }
  });

  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, 'Not authenticated'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ApiError(403, 'You do not have permission to perform this action')
      );
    }

    next();
  };
};

module.exports = authorize;