const { ForbiddenError } = require('../utils/appError');
const logger = require('../utils/logger');

const ALL_ROLES = {
  Admin: 'Sistem Yöneticisi',
  Stock_Manager: 'Stok & Depo Yöneticisi',
  Sales_Manager: 'Satış Yöneticisi',
  Purchase_Manager: 'Satın Alma Yöneticisi',
  Production_Manager: 'Üretim Yöneticisi',
  Quality_Manager: 'Kalite Kontrol Yöneticisi',
  Employee: 'Genel Personel'
};

/**
 * Role-Based Access Control Middleware
 * @param  {...string} allowedRoles - Roles permitted to access route
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ForbiddenError('Kimlik doğrulama başarısız.');
    }

    // Admin has universal permission to all routes
    if (req.user.role === 'Admin') {
      return next();
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.security('Unauthorized Access Attempt Blocked', {
        user: req.user.username,
        role: req.user.role,
        requiredRoles: allowedRoles,
        path: req.originalUrl,
        ip: req.ip
      });
      throw new ForbiddenError(`Bu işlemi gerçekleştirme yetkiniz bulunmamaktadır. (Gerekli Rol: ${allowedRoles.map(r => ALL_ROLES[r] || r).join(', ')})`);
    }

    next();
  };
};

const getRoleLabel = (roleKey) => ALL_ROLES[roleKey] || roleKey;

module.exports = {
  authorizeRoles,
  ALL_ROLES,
  getRoleLabel
};
