const authService = require('../services/authService');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');

class AuthController {
  renderLogin = asyncHandler(async (req, res) => {
    if (req.cookies.token) {
      try {
        jwt.verify(req.cookies.token, JWT_SECRET);
        return res.redirect('/');
      } catch (err) {
        res.clearCookie('token');
      }
    }
    res.render('login', { error: null });
  });

  login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    const user = await authService.login(username, password);

    const payload = {
      id: user.id,
      kullaniciAdi: user.kullaniciAdi || user.username,
      username: user.kullaniciAdi || user.username,
      eposta: user.eposta || user.email,
      email: user.eposta || user.email,
      rol: user.rol || user.role,
      role: user.rol || user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false
    });

    logger.security(`User Logged In Successfully: ${payload.username} (${payload.role})`, { ip: req.ip });

    res.redirect('/');
  });

  renderIndex = asyncHandler(async (req, res) => {
    res.render('index', { user: req.user });
  });

  logout = asyncHandler(async (req, res) => {
    if (req.user) {
      logger.security(`User Logged Out: ${req.user.username || req.user.kullaniciAdi}`, { ip: req.ip });
    }
    res.clearCookie('token');
    res.redirect('/login');
  });
}

module.exports = new AuthController();
