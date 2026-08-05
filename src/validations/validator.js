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
      throw new ValidationError('Gönderilen form verilerinde hatalar mevcut.', errors);
    }
    next();
  };
};

module.exports = validate;
