const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../validations/validator');
const { validateUserCreate, validateUserUpdate } = require('../validations/userValidation');

// Protect all admin routes with JWT verification & Admin RBAC
router.use(verifyToken, authorizeRoles('Admin'));

// Dashboard & Management Summary
router.get('/', adminController.renderDashboard);
router.get('/dashboard', adminController.renderDashboard);

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

// Role & Permission Matrix Management
router.get('/roles', adminController.renderRoles);
router.post('/roles', adminController.updateRoles);

// System Settings & Audit Logs
router.get('/settings', adminController.renderSettings);
router.post('/settings', adminController.updateSettings);
router.get('/logs', adminController.renderLogs);

module.exports = router;
