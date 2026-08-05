const logger = require('../utils/logger');
const { AppError } = require('../utils/appError');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.isOperational ? err.message : 'İşleminiz gerçekleştirilirken beklenmeyen bir sistem hatası oluştu. Lütfen tekrar deneyiniz veya sistem yöneticinize danışınız.';
  let details = err.isOperational ? (err.details || null) : null;

  // Handle Sequelize Validation / Unique Constraint errors nicely
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    message = 'Girdiğiniz kayıt zaten sistemde mevcuttur.';
    details = err.errors ? err.errors.map(e => e.message) : null;
  } else if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = 'Girdiğiniz veriler doğrulama kurallarına uymuyor.';
    details = err.errors ? err.errors.map(e => e.message) : null;
  }

  // Log to error.log file (always log full technical error internally for developers)
  logger.error(err.message || 'System Error', err, {
    path: req.originalUrl,
    method: req.method,
    user: req.user ? req.user.username : 'Anonymous',
    ip: req.ip
  });

  // Check if client expects JSON or HTML
  const isApiRequest = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json')) || req.path.startsWith('/api');

  if (isApiRequest) {
    return res.status(statusCode).json({
      success: false,
      error: {
        message,
        statusCode,
        details
      }
    });
  }

  // Render HTML error view or page
  res.status(statusCode).render('error', {
    user: req.user || null,
    statusCode,
    message,
    details
  });
};

module.exports = errorHandler;
