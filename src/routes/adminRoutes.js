const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../validations/validator');
const { validateUserCreate, validateUserUpdate } = require('../validations/userValidation');

// Protect all admin routes with JWT verification & Admin RBAC
router.use(verifyToken, authorizeRoles('Admin'));

// Redirect root /admin directly to User List
router.get('/', (req, res) => res.redirect('/admin/users'));

// User Management Routes
router.get('/users', adminController.listUsers);
router.get('/users/add', adminController.renderAddUser);
router.post('/users/add', validate(validateUserCreate), adminController.addUser);
router.get('/users/:id', adminController.userDetail);
router.post('/users/:id/update', validate(validateUserUpdate), adminController.updateUser);
router.post('/users/:id/role', adminController.updateUserRole);
router.post('/users/:id/status', adminController.toggleUserStatus);
router.post('/users/:id/reset-password', adminController.resetUserPassword);
router.post('/users/:id/delete', adminController.deleteUser);

// System Settings
router.get('/settings', adminController.renderSettings);
router.post('/settings', adminController.updateSettings);

module.exports = router;
