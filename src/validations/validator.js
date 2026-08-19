const { ValidationError } = require('../utils/appError');
const logger = require('../utils/logger');
const userRepository = require('../repositories/userRepository');

/**
 * Validates request data against schema or validation functions.
 * @param {Function} validateFn - Validation function returning { valid: boolean, errors: [] }
 */
const validate = (validateFn) => {
  return async (req, res, next) => {
    const { valid, errors } = validateFn(req);
    if (!valid) {
      logger.security('Request Validation Failed', {
        path: req.originalUrl,
        errors,
        ip: req.ip,
        user: req.user ? req.user.username : 'Anonymous'
      });

      const { ALL_ROLES } = require('../middleware/rbacMiddleware');
      const adminController = require('../controllers/adminController');
      const errorMessage = errors.join(' ');

      if (req.originalUrl.includes('/admin/users/add')) {
        return res.render('admin/add_user', {
          user: req.user,
          error: errorMessage,
          ALL_ROLES,
          DEPARTMENTS: adminController.DEPARTMENTS,
          DEPARTMENT_TITLES: adminController.DEPARTMENT_TITLES,
          DEPARTMENT_ROLES: adminController.DEPARTMENT_ROLES
        });
      }

      if (req.originalUrl.includes('/update')) {
        const id = req.params.id;
        const targetUser = await userRepository.findById(id).catch(() => null) || { id, ...req.body };
        return res.render('admin/user_detail', {
          user: req.user,
          targetUser,
          error: errorMessage,
          ALL_ROLES,
          DEPARTMENTS: adminController.DEPARTMENTS,
          DEPARTMENT_TITLES: adminController.DEPARTMENT_TITLES,
          DEPARTMENT_ROLES: adminController.DEPARTMENT_ROLES,
          successMessage: null
        });
      }

      throw new ValidationError(errorMessage, errors);
    }
    next();
  };
};

module.exports = validate;
