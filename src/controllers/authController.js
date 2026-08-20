'use strict';
const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

class AuthController {
  /**
   * Giriş Ekranı (Kullanıcı Adı Girişi)
   */
  renderLogin = asyncHandler(async (req, res) => {
    if (req.cookies && req.cookies.token) {
      try {
        jwt.verify(req.cookies.token, JWT_SECRET);
        return res.redirect('/');
      } catch (err) {
        res.clearCookie('token');
      }
    }
    const defaultAccounts = await userRepository.findAll();
    res.render('login', {
      error: req.query.error || null,
      accounts: defaultAccounts.slice(0, 4)
    });
  });

  /**
   * Kullanıcı adına göre 6 haneli doğrulama kodu gönderir
   */
  sendCode = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    try {
      const result = await authService.sendVerificationCode(username, password, req.ip, false);

      // Geçici doğrulama oturum çerezi (15 dk geçerli)
      const sessionPayload = {
        userId: result.userId,
        username: result.username,
        maskedEmail: result.maskedEmail,
        sentAt: Date.now()
      };
      const otpToken = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '15m' });

      res.cookie('otp_session', otpToken, {
        httpOnly: true,
        secure: false,
        maxAge: 15 * 60 * 1000
      });

      return res.redirect('/login/verify');
    } catch (err) {
      const defaultAccounts = await userRepository.findAll();
      return res.render('login', {
        error: err.message || 'Giriş bilgileri doğrulanırken bir hata oluştu.',
        accounts: defaultAccounts.slice(0, 4),
        prevUsername: username || ''
      });
    }
  });

  /**
   * 6 Haneli Doğrulama Kodu Giriş ve Geri Sayım Ekranı
   */
  renderVerify = asyncHandler(async (req, res) => {
    const otpCookie = req.cookies.otp_session;
    if (!otpCookie) {
      return res.redirect('/login');
    }

    let session;
    try {
      session = jwt.verify(otpCookie, JWT_SECRET);
    } catch (err) {
      res.clearCookie('otp_session');
      return res.redirect('/login');
    }

    const user = await userRepository.findById(session.userId);
    if (!user) {
      res.clearCookie('otp_session');
      return res.redirect('/login');
    }

    let remainingSeconds = 0;
    if (user.dogrulamaKoduSonKullanma) {
      const diffMs = new Date(user.dogrulamaKoduSonKullanma).getTime() - Date.now();
      remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));
    }

    res.render('verify_code', {
      userId: user.id,
      username: user.kullaniciAdi,
      maskedEmail: authService.maskEmail(user.eposta),
      remainingSeconds,
      error: req.query.error || null,
      success: req.query.success || null
    });
  });

  /**
   * Girilen 6 haneli kodu doğrular ve kullanıcı oturumu açar
   */
  verifyCode = asyncHandler(async (req, res) => {
    let { userId, code } = req.body;

    // Eğer formdan 6 kutulu ayrı inputlar geldiyse birleştir (digit1..digit6)
    if (!code && req.body.digit1 !== undefined) {
      code = `${req.body.digit1 || ''}${req.body.digit2 || ''}${req.body.digit3 || ''}${req.body.digit4 || ''}${req.body.digit5 || ''}${req.body.digit6 || ''}`;
    }

    if (!userId && req.cookies.otp_session) {
      try {
        const decoded = jwt.verify(req.cookies.otp_session, JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {}
    }

    try {
      const user = await authService.verifyCode(userId, code, req.ip);

      const payload = {
        id: user.id,
        kullaniciAdi: user.kullaniciAdi,
        username: user.kullaniciAdi,
        eposta: user.eposta,
        email: user.eposta,
        ad: user.ad,
        firstName: user.ad,
        soyad: user.soyad,
        lastName: user.soyad,
        rol: user.rol,
        role: user.rol
      };

      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

      res.cookie('token', token, {
        httpOnly: true,
        secure: false
      });

      res.clearCookie('otp_session');

      logger.security(`Kullanıcı Girişi Başarılı (OTP): ${payload.username} (${payload.role})`, { ip: req.ip });

      return res.redirect('/');
    } catch (err) {
      const user = await userRepository.findById(userId);
      let remainingSeconds = 0;
      if (user && user.dogrulamaKoduSonKullanma) {
        const diffMs = new Date(user.dogrulamaKoduSonKullanma).getTime() - Date.now();
        remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));
      }

      return res.render('verify_code', {
        userId,
        username: user ? user.kullaniciAdi : '',
        maskedEmail: user ? authService.maskEmail(user.eposta) : '—',
        remainingSeconds,
        error: err.message || 'Kod doğrulanamadı.',
        success: null
      });
    }
  });

  /**
   * Kalan süre bittiğinde veya talep edildiğinde yeni kod gönderir
   */
  resendCode = asyncHandler(async (req, res) => {
    let { userId } = req.body;

    if (!userId && req.cookies.otp_session) {
      try {
        const decoded = jwt.verify(req.cookies.otp_session, JWT_SECRET);
        userId = decoded.userId;
      } catch (e) {}
    }

    if (!userId) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(400).json({ success: false, message: 'Oturum bulunamadı.' });
      }
      return res.redirect('/login');
    }

    try {
      const user = await userRepository.findById(userId);
      if (!user) throw new Error('Kullanıcı bulunamadı.');

      const result = await authService.sendVerificationCode(user.kullaniciAdi, null, req.ip, true);

      const sessionPayload = {
        userId: result.userId,
        username: result.username,
        maskedEmail: result.maskedEmail,
        sentAt: Date.now()
      };
      const otpToken = jwt.sign(sessionPayload, JWT_SECRET, { expiresIn: '15m' });

      res.cookie('otp_session', otpToken, {
        httpOnly: true,
        secure: false,
        maxAge: 15 * 60 * 1000
      });

      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.json({
          success: true,
          message: 'Yeni 6 haneli doğrulama kodu e-posta adresinize gönderildi.',
          remainingSeconds: 60
        });
      }

      return res.redirect('/login/verify?success=1');
    } catch (err) {
      if (req.xhr || req.headers.accept?.includes('json')) {
        return res.status(400).json({ success: false, message: err.message });
      }
      return res.redirect(`/login/verify?error=${encodeURIComponent(err.message)}`);
    }
  });

  renderIndex = asyncHandler(async (req, res) => {
    res.render('index', { user: req.user });
  });

  logout = asyncHandler(async (req, res) => {
    if (req.user) {
      logger.security(`User Logged Out: ${req.user.username || req.user.kullaniciAdi}`, { ip: req.ip });
    }
    res.clearCookie('token');
    res.clearCookie('otp_session');
    res.redirect('/login');
  });
}

module.exports = new AuthController();
