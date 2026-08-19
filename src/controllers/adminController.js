const userRepository = require('../repositories/userRepository');
const logService = require('../services/logService');
const bcrypt = require('bcrypt');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');

const { APP_DEPARTMENTS } = require('../config/permissionMatrix');

const DEPARTMENT_TITLES = {
  'Sistem Yönetimi & Güvenlik': [
    'Sistem Yöneticisi (Admin)',
    'Sistem & Ağ Uzmanı',
    'Yazılım Geliştirici Uzmanı',
    'Veritabanı Yöneticisi (DBA)',
    'BT Destek Sorumlusu'
  ],
  'Stok & Depo Yönetimi': [
    'Envanter & Depo Müdürü',
    'Ambar Şefi / Sorumlusu',
    'Lojistik Uzmanı',
    'Depo Sevkiyat & Sayım Elemanı'
  ],
  'Satış Yönetimi': [
    'Kıdemli Satış Yöneticisi',
    'Müşteri İlişkileri (CRM) Uzmanı',
    'Bölge Satış Müdürü',
    'Pazarlama & Dijital Saha Sorumlusu'
  ],
  'Satın Alma Yönetimi': [
    'Satın Alma Yöneticisi',
    'Tedarik Zinciri Uzmanı',
    'Satın Alma Sorumlusu',
    'İrsaliye & Mal Kabul Elemanı'
  ],
  'Üretim Planlama & İmalat': [
    'Üretim Müdürü',
    'Planlama Mühendisi (MRP)',
    'Vardiya Amiri',
    'CNC & Tezgah Operatörü'
  ],
  'Kalite Kontrol & Güvence': [
    'Kalite Güvence Yöneticisi',
    'Giriş Kalite Kontrolör (IQC)',
    'Proses & Final Kontrol Uzmanı (IPQC/FQC)'
  ],
  'Genel / Tüm Modüller': [
    'Genel Müdür / Üst Yönetici',
    'Departman Uzmanı',
    'Operasyon Elemanı',
    'Genel Personel'
  ]
};

const DEPARTMENT_ROLES = {
  'Sistem Yönetimi & Güvenlik': [
    { key: 'Admin', label: '🛡️ Sistem Yöneticisi (Admin)' },
    { key: 'Employee', label: '👤 Personel / BT Uzmanı' }
  ],
  'Stok & Depo Yönetimi': [
    { key: 'Stock_Manager', label: '📦 Stok Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Depo Görevlisi' }
  ],
  'Satış Yönetimi': [
    { key: 'Sales_Manager', label: '🛍️ Satış Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Satış Temsilcisi' }
  ],
  'Satın Alma Yönetimi': [
    { key: 'Purchase_Manager', label: '💳 Satın Alma Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Satın Alma Uzmanı' }
  ],
  'Üretim Planlama & İmalat': [
    { key: 'Production_Manager', label: '🏭 Üretim Müdürü' },
    { key: 'Employee', label: '👤 Personel / Üretim Elemanı' }
  ],
  'Kalite Kontrol & Güvence': [
    { key: 'Quality_Manager', label: '🔬 Kalite Kontrol Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Kalite Kontrolör' }
  ],
  'Genel / Tüm Modüller': [
    { key: 'Employee', label: '👤 Personel / Genel' }
  ]
};

const DEPARTMENTS = APP_DEPARTMENTS;

const getDynamicRolesMap = async () => {
  const customRoles = await userRepository.getCustomRoles();
  const map = {};
  customRoles.forEach(r => {
    map[r.key] = r.label;
  });
  return map;
};

class AdminController {
  renderDashboard = asyncHandler(async (req, res) => {
    const users = await userRepository.findAll();
    const settings = await userRepository.getAllSettings();
    const logs = await logService.getRecentLogs(15);

    const userCount = users.length;
    const activeUsersCount = users.filter(u => (u.durum || u.status) === 'Active').length;
    const inactiveUsersCount = users.filter(u => (u.durum || u.status) === 'Inactive').length;
    const suspendedUsersCount = users.filter(u => (u.durum || u.status) === 'Suspended').length;

    const roleCounts = {
      Admin: 0,
      Stock_Manager: 0,
      Sales_Manager: 0,
      Purchase_Manager: 0,
      Production_Manager: 0,
      Quality_Manager: 0,
      Employee: 0
    };

    const deptCounts = {};

    users.forEach(u => {
      const r = u.rol || u.role || 'Employee';
      if (roleCounts[r] !== undefined) roleCounts[r]++;
      else roleCounts[r] = (roleCounts[r] || 0) + 1;

      const d = u.departman || u.department || 'Genel';
      deptCounts[d] = (deptCounts[d] || 0) + 1;
    });

    const maintenanceSetting = settings.find(s => s.anahtar === 'maintenance_mode');
    const isMaintenance = maintenanceSetting && maintenanceSetting.deger === 'true';

    res.render('admin/dashboard', {
      user: req.user,
      users,
      userCount,
      activeUsersCount,
      inactiveUsersCount,
      suspendedUsersCount,
      roleCounts,
      deptCounts,
      settings,
      logs,
      isMaintenance
    });
  });

  listUsers = asyncHandler(async (req, res) => {
    const users = await userRepository.findAll();
    const dynamicRoles = await getDynamicRolesMap();
    res.render('admin/users', { user: req.user, users, ALL_ROLES: dynamicRoles, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
  });

  renderAddUser = asyncHandler(async (req, res) => {
    const customRoles = await userRepository.getCustomRoles();
    const dynamicRoles = await getDynamicRolesMap();
    res.render('admin/add_user', { user: req.user, error: null, ALL_ROLES: dynamicRoles, customRoles, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
  });

  addUser = asyncHandler(async (req, res) => {
    const { username, password, email, firstName, lastName, phone, department, title, role, kullaniciAdi, sifre, eposta, ad, soyad, telefon, departman, unvan, rol } = req.body;
    const targetUsername = kullaniciAdi || username;
    const targetPassword = sifre || password;
    const targetEmail = eposta || email;
    const customRoles = await userRepository.getCustomRoles();
    const dynamicRoles = await getDynamicRolesMap();

    const existingUser = await userRepository.findByUsername(targetUsername);
    if (existingUser) {
      return res.render('admin/add_user', { user: req.user, error: 'Bu kullanıcı adı sistemde zaten kayıtlı.', ALL_ROLES: dynamicRoles, customRoles, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
    }

    if (targetEmail) {
      const existingEmail = await userRepository.findByEmail(targetEmail);
      if (existingEmail) {
        return res.render('admin/add_user', { user: req.user, error: 'Bu e-posta adresi sistemde zaten kayıtlı.', ALL_ROLES: dynamicRoles, customRoles, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
      }
    }

    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    await userRepository.create({
      kullaniciAdi: targetUsername,
      sifre: hashedPassword,
      eposta: targetEmail ? targetEmail.trim() : null,
      ad: ad || firstName,
      soyad: soyad || lastName,
      telefon: telefon ? telefon.trim() : (phone ? phone.trim() : null),
      departman: departman ? departman.trim() : (department ? department.trim() : 'Genel / Tüm Modüller'),
      unvan: unvan ? unvan.trim() : (title ? title.trim() : 'Personel'),
      rol: rol || role || 'Employee',
      durum: 'Active'
    }, req.user, req.ip);

    res.redirect('/admin/users');
  });

  userDetail = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const targetUser = await userRepository.findById(id);
    const customRoles = await userRepository.getCustomRoles();
    const dynamicRoles = await getDynamicRolesMap();

    if (!targetUser) {
      throw new NotFoundError('Kullanıcı bulunamadı');
    }

    res.render('admin/user_detail', {
      user: req.user,
      targetUser,
      ALL_ROLES: dynamicRoles,
      customRoles,
      DEPARTMENTS,
      DEPARTMENT_TITLES,
      DEPARTMENT_ROLES,
      successMessage: req.query.success || null
    });
  });

  renderLogs = asyncHandler(async (req, res) => {
    const { action, entity, search } = req.query;
    const logs = await logService.getRecentLogs(150, { action, entity, search });
    res.render('admin/logs', {
      user: req.user,
      logs,
      queryAction: action || '',
      queryEntity: entity || '',
      searchQuery: search || ''
    });
  });

  updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { firstName, lastName, email, phone, department, title, role, status, ad, soyad, eposta, telefon, departman, unvan, rol, durum } = req.body;

    const updateData = {
      ad: ad ? ad.trim() : (firstName ? firstName.trim() : ''),
      soyad: soyad ? soyad.trim() : (lastName ? lastName.trim() : ''),
      eposta: eposta ? eposta.trim() : (email ? email.trim() : null),
      telefon: telefon ? telefon.trim() : (phone ? phone.trim() : null),
      departman: departman ? departman.trim() : (department ? department.trim() : 'Genel'),
      unvan: unvan ? unvan.trim() : (title ? title.trim() : 'Personel'),
      rol: rol || role || 'Employee',
      durum: durum || status || 'Active'
    };

    const updatedUser = await userRepository.updateUser(id, updateData, req.user, req.ip);
    if (!updatedUser) {
      throw new NotFoundError('Güncellenecek kullanıcı bulunamadı.');
    }

    res.redirect(`/admin/users/${id}?success=Kullanıcı bilgileri başarıyla güncellendi.`);
  });

  updateUserRole = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { role, rol } = req.body;

    const updatedUser = await userRepository.updateRole(id, rol || role, req.user, req.ip);
    if (!updatedUser) {
      throw new NotFoundError('Güncellenecek kullanıcı bulunamadı.');
    }

    res.redirect(`/admin/users/${id}`);
  });

  toggleUserStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, durum } = req.body;
    const targetStatus = durum || status;

    if (!['Active', 'Inactive', 'Suspended'].includes(targetStatus)) {
      throw new ValidationError('Geçersiz kullanıcı durumu.');
    }

    const updated = await userRepository.toggleStatus(id, targetStatus, req.user, req.ip);
    if (!updated) throw new NotFoundError('Kullanıcı bulunamadı.');

    res.redirect('/admin/users');
  });

  resetUserPassword = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { newPassword, yeniSifre } = req.body;
    const pass = yeniSifre || newPassword;

    if (!pass || pass.length < 6) {
      throw new ValidationError('Yeni şifre en az 6 karakter olmalıdır.');
    }

    const updated = await userRepository.resetPassword(id, pass, req.user, req.ip);
    if (!updated) throw new NotFoundError('Kullanıcı bulunamadı.');

    res.redirect(`/admin/users/${id}?success=Parola başarıyla güncellendi.`);
  });

  deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    
    if (Number(id) === req.user.id) {
      throw new ValidationError('Kendi kullanıcı hesabınızı silemezsiniz.');
    }

    await userRepository.deleteUser(id, req.user, req.ip);
    res.redirect('/admin/users');
  });

  renderSettings = asyncHandler(async (req, res) => {
    const settings = await userRepository.getAllSettings();
    res.render('admin/settings', { user: req.user, settings, successMessage: req.query.success || null });
  });

  updateSettings = asyncHandler(async (req, res) => {
    await userRepository.updateSettings(req.body, req.user, req.ip);
    res.redirect('/admin/settings?success=Sistem parametreleri başarıyla güncellendi.');
  });

  renderRoles = asyncHandler(async (req, res) => {
    const { PERMISSION_MODULES, APP_DEPARTMENTS } = require('../config/permissionMatrix');
    const customRoles = await userRepository.getCustomRoles();
    const matrix = await userRepository.getPermissionMatrix();
    const allUsers = await userRepository.findAll();

    const roleUserCounts = {};
    customRoles.forEach(r => { roleUserCounts[r.key] = 0; });
    allUsers.forEach(u => {
      const userRole = u.rol || u.role;
      if (typeof roleUserCounts[userRole] !== 'undefined') {
        roleUserCounts[userRole]++;
      }
    });

    const dynamicAllRoles = {};
    customRoles.forEach(r => {
      dynamicAllRoles[r.key] = r.label;
    });

    res.render('admin/roles', {
      user: req.user,
      ALL_ROLES: dynamicAllRoles,
      customRoles,
      matrix,
      roleUserCounts,
      PERMISSION_MODULES,
      DEPARTMENTS: APP_DEPARTMENTS,
      DEPARTMENT_TITLES,
      DEPARTMENT_ROLES,
      successMessage: req.query.success || null,
      errorMessage: req.query.error || null,
      activeRole: req.query.role || customRoles[0]?.key || 'Admin',
      activeTab: req.query.tab || '1'
    });
  });

  createRole = asyncHandler(async (req, res) => {
    const { label, department, description } = req.body;
    if (!label || !label.trim()) {
      throw new ValidationError('Rol adı zorunludur.');
    }

    const customRoles = await userRepository.getCustomRoles();
    const matrix = await userRepository.getPermissionMatrix();

    let keySlug = label.trim().replace(/[^a-zA-Z0-9]/g, '_');
    if (!keySlug || keySlug.length < 2) keySlug = 'Custom_Role_' + Date.now();
    if (customRoles.some(r => r.key === keySlug)) {
      keySlug += '_' + Math.floor(Math.random() * 1000);
    }

    const newRoleObj = {
      key: keySlug,
      label: label.trim(),
      department: department ? department.trim() : 'Genel',
      description: description ? description.trim() : 'Özel tanımlanmış kullanıcı rolü',
      isSystem: false
    };

    customRoles.push(newRoleObj);
    await userRepository.saveCustomRoles(customRoles, req.user, req.ip);

    const { PERMISSION_MODULES } = require('../config/permissionMatrix');
    matrix[keySlug] = {};
    PERMISSION_MODULES.forEach(mod => {
      mod.permissions.forEach(p => {
        matrix[keySlug][p.key] = p.key.includes('_view') || p.key.includes('_items') || p.key.includes('_orders');
      });
    });

    await userRepository.savePermissionMatrix(matrix, req.user, req.ip);
    res.redirect(`/admin/roles?role=${keySlug}&tab=2&success=Yeni+rol+${encodeURIComponent(label.trim())}+başarıyla+oluşturuldu.`);
  });

  updateRole = asyncHandler(async (req, res) => {
    const { key, label, department, description } = req.body;
    const customRoles = await userRepository.getCustomRoles();
    const targetRole = customRoles.find(r => r.key === key);

    if (targetRole) {
      if (label && label.trim()) targetRole.label = label.trim();
      if (department) targetRole.department = department.trim();
      if (typeof description !== 'undefined') targetRole.description = description.trim();

      await userRepository.saveCustomRoles(customRoles, req.user, req.ip);
    }

    res.redirect(`/admin/roles?role=${key}&tab=1&success=Rol+bilgileri+başarıyla+güncellendi.`);
  });

  deleteRole = asyncHandler(async (req, res) => {
    const { key } = req.body;
    if (key === 'Admin') {
      throw new ValidationError('Sistem Yöneticisi (Admin) rolü silinemez.');
    }

    let customRoles = await userRepository.getCustomRoles();
    const roleToDelete = customRoles.find(r => r.key === key);
    if (roleToDelete && roleToDelete.isSystem) {
      throw new ValidationError('Sistem başlangıç rolü silinemez.');
    }

    customRoles = customRoles.filter(r => r.key !== key);
    await userRepository.saveCustomRoles(customRoles, req.user, req.ip);

    const matrix = await userRepository.getPermissionMatrix();
    delete matrix[key];
    await userRepository.savePermissionMatrix(matrix, req.user, req.ip);

    const allUsers = await userRepository.findAll();
    for (const u of allUsers) {
      if (u.rol === key || u.role === key) {
        await userRepository.updateRole(u.id, 'Employee', req.user, req.ip);
      }
    }

    res.redirect('/admin/roles?tab=1&success=Rol+başarıyla+silindi+ve+bağlı+kullanıcılar+Genel+Personel+rolüne+aktarıldı.');
  });

  updateRolePermissions = asyncHandler(async (req, res) => {
    const { roleKey } = req.body;
    const { PERMISSION_MODULES } = require('../config/permissionMatrix');
    const matrix = await userRepository.getPermissionMatrix();

    if (!matrix[roleKey]) matrix[roleKey] = {};

    PERMISSION_MODULES.forEach(mod => {
      mod.permissions.forEach(p => {
        const fieldKey = `perm_${roleKey}_${p.key}`;
        matrix[roleKey][p.key] = req.body[fieldKey] === 'on' || req.body[fieldKey] === 'true';
      });
    });

    await userRepository.savePermissionMatrix(matrix, req.user, req.ip);
    res.redirect(`/admin/roles?role=${roleKey}&tab=2&success=Rol+yetkileri+başarıyla+güncellendi.`);
  });

  updateRoles = asyncHandler(async (req, res) => {
    const { PERMISSION_MODULES } = require('../config/permissionMatrix');
    const customRoles = await userRepository.getCustomRoles();
    const matrix = await userRepository.getPermissionMatrix();

    customRoles.forEach(r => {
      if (!matrix[r.key]) matrix[r.key] = {};
      PERMISSION_MODULES.forEach(mod => {
        mod.permissions.forEach(p => {
          const fieldKey = `perm_${r.key}_${p.key}`;
          if (typeof req.body[fieldKey] !== 'undefined') {
            matrix[r.key][p.key] = req.body[fieldKey] === 'on' || req.body[fieldKey] === 'true';
          }
        });
      });
    });

    await userRepository.savePermissionMatrix(matrix, req.user, req.ip);
    res.redirect('/admin/roles?success=Tüm+rol+ve+yetkiler+başarıyla+güncellendi.');
  });
}

const adminControllerInstance = new AdminController();
adminControllerInstance.DEPARTMENTS = DEPARTMENTS;
adminControllerInstance.DEPARTMENT_TITLES = DEPARTMENT_TITLES;
adminControllerInstance.DEPARTMENT_ROLES = DEPARTMENT_ROLES;

module.exports = adminControllerInstance;
