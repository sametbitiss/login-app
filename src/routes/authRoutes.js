const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/authMiddleware');
const validate = require('../validations/validator');
const { validateLogin } = require('../validations/authValidation');

router.get('/login', authController.renderLogin);
router.post('/login', validate(validateLogin), authController.login);
router.get('/', verifyToken, authController.renderIndex);
router.get('/logout', authController.logout);

module.exports = router;
