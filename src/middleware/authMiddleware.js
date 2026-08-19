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

      const userStatus = dbUser.durum || dbUser.status;
      const userName = dbUser.kullaniciAdi || dbUser.username;

      if (userStatus && userStatus !== 'Active') {
        logger.security(`Inactive User Access Attempt: ${userName}`, { ip: req.ip });
        res.clearCookie('token');
        if (req.xhr || req.path.startsWith('/api')) {
          throw new ForbiddenError('Hesabınız dondurulmuş veya pasife alınmıştır.');
        }
        return res.render('login', { error: 'Hesabınız pasife alınmıştır. Lütfen sistem yöneticisi ile iletişime geçiniz.' });
      }

      const { SistemAyari } = require('../../models');
      const maintenanceSetting = await SistemAyari.findOne({ where: { anahtar: 'maintenance_mode' } });
      const isMaintenance = maintenanceSetting && maintenanceSetting.deger === 'true';

      const activeUser = {
        id: dbUser.id,
        kullaniciAdi: dbUser.kullaniciAdi || dbUser.username,
        username: dbUser.kullaniciAdi || dbUser.username,
        eposta: dbUser.eposta || dbUser.email,
        email: dbUser.eposta || dbUser.email,
        ad: dbUser.ad || dbUser.firstName,
        firstName: dbUser.ad || dbUser.firstName,
        soyad: dbUser.soyad || dbUser.lastName,
        lastName: dbUser.soyad || dbUser.lastName,
        rol: dbUser.rol || dbUser.role,
        role: dbUser.rol || dbUser.role,
        durum: dbUser.durum || dbUser.status,
        status: dbUser.durum || dbUser.status
      };

      if (isMaintenance && activeUser.role !== 'Admin') {
        logger.security(`Maintenance Mode Blocked Access Attempt: ${activeUser.username}`, { ip: req.ip });
        return res.status(503).render('maintenance', { user: activeUser });
      }

      req.user = activeUser;
      res.locals.user = activeUser;
      next();
    } catch (err) {
      console.error('JWT VERIFY ERROR:', err.message, err.stack);
      logger.security('Invalid or Expired JWT Token Attempt', { ip: req.ip, path: req.originalUrl });
      res.clearCookie('token');
      if (req.xhr || req.path.startsWith('/api')) {
        throw new UnauthorizedError('Oturumunuzun süresi doldu. Lütfen tekrar giriş yapın.');
      }
      return res.redirect('/login');
    }
  }
};
