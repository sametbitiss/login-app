const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const validate = require('../validations/validator');
const { validateSendCode, validateVerifyCode } = require('../validations/authValidation');

// 1. Giriş Sayfası & Kod Gönderme
router.get('/login', authController.renderLogin);
router.post('/login', validate(validateSendCode), authController.sendCode);
router.post('/login/send-code', validate(validateSendCode), authController.sendCode);

// 2. 6 Haneli Doğrulama Kodu Ekranı & Giriş
router.get('/login/verify', authController.renderVerify);
router.get('/verify-code', (req, res) => res.redirect('/login/verify'));
router.post('/login/verify', validate(validateVerifyCode), authController.verifyCode);

// 3. Tekrar Kod Gönderme
router.post('/login/resend', authController.resendCode);

// 4. Ana Sayfa & Çıkış
router.get('/', verifyToken, authController.renderIndex);
router.get('/logout', authController.logout);

module.exports = router;
