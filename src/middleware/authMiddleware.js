const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const logger = require('../utils/logger');
const { UnauthorizedError, ForbiddenError } = require('../utils/appError');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-erp-system-2026';

module.exports = {
  JWT_SECRET,

  verifyToken: async (req, res, next) => {
    const token = req.cookies.token;

    if (!token) {
      if (req.xhr || req.path.startsWith('/api')) {
        throw new UnauthorizedError('Oturum anahtarı bulunamadı.');
      }
      return res.redirect('/login');
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      const dbUser = await userRepository.findById(decoded.id);
      if (!dbUser) {
        res.clearCookie('token');
        return res.redirect('/login');
      }

      // Check if user account is active
      if (dbUser.status && dbUser.status !== 'Active') {
        logger.security(`Inactive User Access Attempt: ${dbUser.username}`, { ip: req.ip });
        res.clearCookie('token');
        if (req.xhr || req.path.startsWith('/api')) {
          throw new ForbiddenError('Hesabınız dondurulmuş veya pasife alınmıştır.');
        }
        return res.render('login', { error: 'Hesabınız pasife alınmıştır. Lütfen sistem yöneticisi ile iletişime geçiniz.' });
      }

      // Check System Maintenance Mode
      const { SystemSetting } = require('../../models');
      const maintenanceSetting = await SystemSetting.findOne({ where: { key: 'maintenance_mode' } });
      const isMaintenance = maintenanceSetting && maintenanceSetting.value === 'true';

      const activeUser = {
        id: dbUser.id,
        username: dbUser.username,
        email: dbUser.email,
        firstName: dbUser.firstName,
        lastName: dbUser.lastName,
        role: dbUser.role,
        status: dbUser.status
      };

      if (isMaintenance && activeUser.role !== 'Admin') {
        logger.security(`Maintenance Mode Blocked Access Attempt: ${activeUser.username}`, { ip: req.ip });
        return res.status(503).render('maintenance', { user: activeUser });
      }

      req.user = activeUser;
      res.locals.user = activeUser;
      next();
    } catch (err) {
      logger.security('Invalid or Expired JWT Token Attempt', { ip: req.ip, path: req.originalUrl });
      res.clearCookie('token');
      if (req.xhr || req.path.startsWith('/api')) {
        throw new UnauthorizedError('Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
      }
      return res.redirect('/login');
    }
  }
};
