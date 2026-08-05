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
        // Token invalid, clear cookie
        res.clearCookie('token');
      }
    }
    res.render('login', { error: null });
  });

  login = asyncHandler(async (req, res) => {
    const { username, password } = req.body;
    
    // Auth logic
    const user = await authService.login(username, password);

    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false
    });

    logger.security(`User Logged In Successfully: ${user.username} (${user.role})`, { ip: req.ip });

    res.redirect('/');
  });

  renderIndex = asyncHandler(async (req, res) => {
    res.render('index', { user: req.user });
  });

  logout = asyncHandler(async (req, res) => {
    if (req.user) {
      logger.security(`User Logged Out: ${req.user.username}`, { ip: req.ip });
    }
    res.clearCookie('token');
    res.redirect('/login');
  });
}

module.exports = new AuthController();
