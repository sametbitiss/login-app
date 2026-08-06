const { ValidationError } = require('../utils/appError');
const logger = require('../utils/logger');

/**
 * Validates request data against schema or validation functions.
 * @param {Function} validateFn - Validation function returning { valid: boolean, errors: [] }
 */
const validate = (validateFn) => {
  return (req, res, next) => {
    const { valid, errors } = validateFn(req);
    if (!valid) {
      logger.security('Request Validation Failed', {
        path: req.originalUrl,
        errors,
        ip: req.ip,
        user: req.user ? req.user.username : 'Anonymous'
      });

      if (req.originalUrl.includes('/admin/users/add')) {
        const { ALL_ROLES } = require('../middleware/rbacMiddleware');
        const adminController = require('../controllers/adminController');
        return res.render('admin/add_user', {
          user: req.user,
          error: errors.join(' '),
          ALL_ROLES,
          DEPARTMENTS: adminController.DEPARTMENTS,
          DEPARTMENT_TITLES: adminController.DEPARTMENT_TITLES,
          DEPARTMENT_ROLES: adminController.DEPARTMENT_ROLES
        });
      }

      throw new ValidationError(errors.join(' '), errors);
    }
    next();
  };
};

module.exports = validate;
