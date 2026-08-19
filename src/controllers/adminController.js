const userRepository = require('../repositories/userRepository');
const logService = require('../services/logService');
const bcrypt = require('bcrypt');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');

const DEPARTMENT_TITLES = {
  'Bilgi Teknolojileri & BT': [
    'Sistem Yöneticisi (Admin)',
    'Sistem & Ağ Uzmanı',
    'Yazılım Geliştirici Uzmanı',
    'Veritabanı Yöneticisi (DBA)',
    'BT Destek Sorumlusu'
  ],
  'Yönetim Kurulu & Genel Müdürlük': [
    'Genel Müdür',
    'Yönetim Kurulu Başkanı',
    'Genel Müdür Yardımcısı',
    'Genel Sekreter / Asistan'
  ],
  'Stok & Depo Lojistik Yönetimi': [
    'Envanter & Depo Müdürü',
    'Ambar Şefi / Sorumlusu',
    'Lojistik Uzmanı',
    'Depo Sevkiyat & Sayım Elemanı'
  ],
  'Satış & Pazarlama Direktörlüğü': [
    'Kıdemli Satış Yöneticisi',
    'Müşteri İlişkileri (CRM) Uzmanı',
    'Bölge Satış Müdürü',
    'Pazarlama & Dijital Saha Sorumlusu'
  ],
  'Satın Alma & Tedarik Zinciri': [
    'Satın Alma Müdürü',
    'Tedarik Zinciri Uzmanı',
    'Satın Alma Sorumlusu',
    'İrsaliye & Mal Kabul Elemanı'
  ],
  'Üretim & İmalat Planlama': [
    'Üretim Müdürü',
    'Planlama Mühendisi (MRP)',
    'Vardiya Amiri',
    'CNC & Tezgah Operatörü'
  ],
  'İnsan Kaynakları': [
    'İnsan Kaynakları Yöneticisi',
    'İKK & İşe Alım Uzmanı',
    'Bordro & Özlük İşleri Sorumlusu'
  ],
  'Kalite Kontrol & Güvence': [
    'Kalite Güvence Yöneticisi',
    'Giriş Kalite Kontrolör (IQC)',
    'Proses & Final Kontrol Uzmanı (IPQC/FQC)'
  ],
  'Kurumsal Operasyonlar': [
    'Operasyon Müdürü',
    'Operasyon Uzmanı',
    'Ofis Yöneticisi'
  ]
};

const DEPARTMENT_ROLES = {
  'Bilgi Teknolojileri & BT': [
    { key: 'Admin', label: '🛡️ Sistem Yöneticisi (Admin)' },
    { key: 'Employee', label: '👤 Personel / BT Uzmanı' }
  ],
  'Yönetim Kurulu & Genel Müdürlük': [
    { key: 'Admin', label: '🛡️ Sistem Yöneticisi (Admin)' },
    { key: 'Employee', label: '👤 Personel / Yönetici' }
  ],
  'Stok & Depo Lojistik Yönetimi': [
    { key: 'Stock_Manager', label: '📦 Stok Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Depo Görevlisi' }
  ],
  'Satış & Pazarlama Direktörlüğü': [
    { key: 'Sales_Manager', label: '🛍️ Satış Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Satış Temsilcisi' }
  ],
  'Satın Alma & Tedarik Zinciri': [
    { key: 'Purchase_Manager', label: '💳 Satın Alma Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Satın Alma Uzmanı' }
  ],
  'Üretim & İmalat Planlama': [
    { key: 'Production_Manager', label: '🏭 Üretim Müdürü' },
    { key: 'Employee', label: '👤 Personel / Üretim Elemanı' }
  ],
  'İnsan Kaynakları': [
    { key: 'Employee', label: '👤 Personel / HR Sorumlusu' }
  ],
  'Kalite Kontrol & Güvence': [
    { key: 'Quality_Manager', label: '🔬 Kalite Kontrol Yöneticisi' },
    { key: 'Employee', label: '👤 Personel / Kalite Kontrolör' }
  ],
  'Kurumsal Operasyonlar': [
    { key: 'Employee', label: '👤 Personel / Operasyon' }
  ]
};

const DEPARTMENTS = Object.keys(DEPARTMENT_TITLES);

class AdminController {
  renderDashboard = asyncHandler(async (req, res) => {
    const users = await userRepository.findAll();
    const settings = await userRepository.getAllSettings();
    const userCount = users.length;
    const activeUsersCount = users.filter(u => (u.durum || u.status) === 'Active').length;

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
    res.render('admin/users', { user: req.user, users, ALL_ROLES, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
  });

  renderAddUser = asyncHandler(async (req, res) => {
    res.render('admin/add_user', { user: req.user, error: null, ALL_ROLES, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
  });

  addUser = asyncHandler(async (req, res) => {
    const { username, password, email, firstName, lastName, phone, department, title, role, kullaniciAdi, sifre, eposta, ad, soyad, telefon, departman, unvan, rol } = req.body;
    const targetUsername = kullaniciAdi || username;
    const targetPassword = sifre || password;

    const existingUser = await userRepository.findByUsername(targetUsername);
    if (existingUser) {
      return res.render('admin/add_user', { user: req.user, error: 'Bu kullanıcı adı zaten alınmış.', ALL_ROLES, DEPARTMENTS, DEPARTMENT_TITLES, DEPARTMENT_ROLES });
    }

    const hashedPassword = await bcrypt.hash(targetPassword, 10);

    await userRepository.create({
      kullaniciAdi: targetUsername,
      sifre: hashedPassword,
      eposta: eposta || email,
      ad: ad || firstName,
      soyad: soyad || lastName,
      telefon: telefon ? telefon.trim() : (phone ? phone.trim() : null),
      departman: departman ? departman.trim() : (department ? department.trim() : 'Genel'),
      unvan: unvan ? unvan.trim() : (title ? title.trim() : 'Personel'),
      rol: rol || role || 'Employee',
      durum: 'Active'
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
