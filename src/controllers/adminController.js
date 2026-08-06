const userRepository = require('../repositories/userRepository');
const logService = require('../services/logService');
const bcrypt = require('bcrypt');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');

const DEPARTMENTS = [
  'Sistem Yönetimi',
  'Stok & Depo Yönetimi',
  'Satış Yönetimi',
  'Satın Alma Yönetimi',
  'Üretim Planlama',
  'Kalite Kontrol',
  'İnsan Kaynakları',
  'Finans & Muhasebe',
  'Genel'
];

class AdminController {
  renderDashboard = asyncHandler(async (req, res) => {
    const users = await userRepository.findAll();
    const settings = await userRepository.getAllSettings();
    const userCount = users.length;
    const activeUsersCount = users.filter(u => u.status === 'Active').length;

    res.render('admin/dashboard', {
      user: req.user,
      users,
      userCount,
      activeUsersCount,
      settings
    });
  });

  listUsers = asyncHandler(async (req, res) => {
    const users = await userRepository.findAll();
    res.render('admin/users', { user: req.user, users, ALL_ROLES, DEPARTMENTS });
  });

  renderAddUser = asyncHandler(async (req, res) => {
    res.render('admin/add_user', { user: req.user, error: null, ALL_ROLES, DEPARTMENTS });
  });

  addUser = asyncHandler(async (req, res) => {
    const { username, password, email, firstName, lastName, phone, department, title, role } = req.body;

    const existingUser = await userRepository.findByUsername(username);
    if (existingUser) {
      return res.render('admin/add_user', { user: req.user, error: 'Bu kullanıcı adı zaten alınmış.', ALL_ROLES, DEPARTMENTS });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await userRepository.create({
      username,
      password: hashedPassword,
      email,
      firstName,
      lastName,
      phone: phone ? phone.trim() : null,
      department: department ? department.trim() : 'Genel',
      title: title ? title.trim() : 'Personel',
      role: role || 'Employee',
      status: 'Active'
    }, req.user, req.ip);

    res.redirect('/admin/users');
  });

  userDetail = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const targetUser = await userRepository.findById(id);

    if (!targetUser) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    res.render('admin/user_detail', {
      user: req.user,
      targetUser,
      ALL_ROLES,
      DEPARTMENTS,
      successMessage: req.query.success || null
    });
  });

  // Full User Details Update (FirstName, LastName, Email, Phone, Department, Title, Role, Status)
  updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phone, department, title, role, status } = req.body;

    const updateData = {
      firstName: firstName ? firstName.trim() : '',
      lastName: lastName ? lastName.trim() : '',
      email: email ? email.trim() : null,
      phone: phone ? phone.trim() : null,
      department: department ? department.trim() : 'Genel',
      title: title ? title.trim() : 'Personel',
      role: role || 'Employee',
      status: status || 'Active'
    };

    const updatedUser = await userRepository.updateUser(id, updateData, req.user, req.ip);
    if (!updatedUser) {
      throw new NotFoundError('Güncellenecek kullanıcı bulunamadı.');
    }

    res.redirect(`/admin/users/${id}?success=Kullanıcı bilgileri başarıyla güncellendi.`);
  });

  updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role } = req.body;

    const updatedUser = await userRepository.updateRole(id, role, req.user, req.ip);
    if (!updatedUser) {
      throw new NotFoundError('Güncellenecek kullanıcı bulunamadı.');
    }

    res.redirect(`/admin/users/${id}`);
  });

  toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body; // Active, Inactive, Suspended

    if (!['Active', 'Inactive', 'Suspended'].includes(status)) {
      throw new ValidationError('Geçersiz kullanıcı durumu.');
    }

    const updated = await userRepository.toggleStatus(id, status, req.user, req.ip);
    if (!updated) throw new NotFoundError('Kullanıcı bulunamadı.');

    res.redirect('/admin/users');
  });

  resetUserPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      throw new ValidationError('Yeni şifre en az 6 karakter olmalıdır.');
    }

    const updated = await userRepository.resetPassword(id, newPassword, req.user, req.ip);
    if (!updated) throw new NotFoundError('Kullanıcı bulunamadı.');

    res.redirect(`/admin/users/${id}?success=Parola başarıyla güncellendi.`);
  });

  deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    // Prevent self deletion
    if (Number(id) === req.user.id) {
      throw new ValidationError('Kendi kullanıcı hesabınızı silemezsiniz.');
    }

    await userRepository.deleteUser(id, req.user, req.ip);
    res.redirect('/admin/users');
  });

  // --- SYSTEM SETTINGS & PERMISSIONS ---
  renderSettings = asyncHandler(async (req, res) => {
    const settings = await userRepository.getAllSettings();
    res.render('admin/settings', { user: req.user, settings });
  });

  updateSettings = asyncHandler(async (req, res) => {
    await userRepository.updateSettings(req.body, req.user, req.ip);
    res.redirect('/admin/settings');
  });

  renderRoles = asyncHandler(async (req, res) => {
    const { PERMISSION_MODULES } = require('../config/permissionMatrix');
    const matrix = await userRepository.getPermissionMatrix();
    const roleKeys = Object.keys(ALL_ROLES);
    res.render('admin/roles', {
      user: req.user,
      ALL_ROLES,
      roleKeys,
      PERMISSION_MODULES,
      matrix,
      successMessage: req.query.success || null
    });
  });

  updateRoles = asyncHandler(async (req, res) => {
    const { PERMISSION_MODULES } = require('../config/permissionMatrix');
    const roleKeys = Object.keys(ALL_ROLES);
    const newMatrix = {};

    for (const role of roleKeys) {
      newMatrix[role] = {};
      for (const mod of PERMISSION_MODULES) {
        for (const p of mod.permissions) {
          const fieldKey = `perm_${role}_${p.key}`;
          newMatrix[role][p.key] = req.body[fieldKey] === 'on' || req.body[fieldKey] === 'true';
        }
      }
    }

    await userRepository.savePermissionMatrix(newMatrix, req.user, req.ip);
    res.redirect('/admin/roles?success=Rol+ve+yetki+matrisi+başarıyla+güncellendi.');
  });
}

module.exports = new AdminController();
