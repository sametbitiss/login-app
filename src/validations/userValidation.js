const validRoles = [
  'Admin',
  'Stock_Manager',
  'Sales_Manager',
  'Purchase_Manager',
  'Production_Manager',
  'Quality_Manager',
  'Employee'
];

const validStatuses = ['Active', 'Inactive', 'Suspended'];

const isValidEmail = (email) => {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  if (trimmed.length < 5 || trimmed.length > 100) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,10}$/;
  if (!emailRegex.test(trimmed)) return false;
  if (trimmed.includes('..') || trimmed.includes('@.') || trimmed.includes('.@') || trimmed.endsWith('.')) return false;
  return true;
};

const isValidPhone = (phone) => {
  if (!phone || typeof phone !== 'string') return true; // Optional field, but if filled, must be valid
  const trimmed = phone.trim();
  if (trimmed === '') return true;

  // Reject if contains any letters
  if (/[a-zA-ZçğıöşüÇĞİÖŞÜ]/.test(trimmed)) return false;

  // Must match phone format (digits, +, -, (, ), spaces allowed)
  const phoneFormatRegex = /^[\+\(\)\-\s0-9]{10,20}$/;
  if (!phoneFormatRegex.test(trimmed)) return false;

  // Extract digits only; must have between 10 and 15 digits
  const digitsOnly = trimmed.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
};

const isValidName = (name) => {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (trimmed === '') return true;
  // Allows letters, spaces, apostrophes and hyphens; no numbers or special symbols
  const nameRegex = /^[a-zA-ZçğıöşüÇĞİÖŞÜ\s'-]{2,50}$/;
  return nameRegex.test(trimmed);
};

const isValidUsername = (username) => {
  if (!username || typeof username !== 'string') return false;
  const usernameRegex = /^[a-zA-Z0-9_.-]{3,30}$/;
  return usernameRegex.test(username.trim());
};

const validateUserCreate = (req) => {
  const { username, kullaniciAdi, password, sifre, email, eposta, phone, telefon, firstName, ad, lastName, soyad, role, rol } = req.body || {};
  const errors = [];

  const targetUsername = kullaniciAdi || username;
  const targetPassword = sifre || password;
  const targetEmail = eposta || email;
  const targetPhone = telefon || phone;
  const targetAd = ad || firstName;
  const targetSoyad = soyad || lastName;
  const targetRole = rol || role;

  // 1. Kullanıcı Adı
  if (!isValidUsername(targetUsername)) {
    errors.push('Kullanıcı adı en az 3 karakter olmalı, harf, rakam, alt tire (_) veya nokta içermelidir.');
  }

  // 2. Şifre
  if (!targetPassword || targetPassword.length < 6) {
    errors.push('Şifre en az 6 karakter uzunluğunda olmalıdır.');
  }

  // 3. E-Posta
  if (!isValidEmail(targetEmail)) {
    errors.push('Lütfen geçerli bir e-posta adresi giriniz (Örn: ahmet@enterprise-erp.com).');
  }

  // 4. Telefon
  if (!isValidPhone(targetPhone)) {
    errors.push('Telefon numarası yalnızca rakam ve telefon karakterleri (+, -, parantez) içerebilir ve en az 10 rakamdan oluşmalıdır.');
  }

  // 5. Ad & Soyad
  if (targetAd && !isValidName(targetAd)) {
    errors.push('Ad alanına rakam veya özel karakter girilemez.');
  }
  if (targetSoyad && !isValidName(targetSoyad)) {
    errors.push('Soyad alanına rakam veya özel karakter girilemez.');
  }

  // 6. Rol
  if (targetRole && (typeof targetRole !== 'string' || targetRole.trim() === '')) {
    errors.push('Geçersiz kullanıcı rolü seçildi.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateUserUpdate = (req) => {
  const { email, eposta, phone, telefon, firstName, ad, lastName, soyad, role, rol, status, durum } = req.body || {};
  const errors = [];

  const targetEmail = eposta || email;
  const targetPhone = telefon || phone;
  const targetAd = ad || firstName;
  const targetSoyad = soyad || lastName;
  const targetRole = rol || role;
  const targetStatus = durum || status;

  // 1. E-Posta
  if (targetEmail && !isValidEmail(targetEmail)) {
    errors.push('Lütfen geçerli bir e-posta adresi giriniz (Örn: ahmet@enterprise-erp.com).');
  }

  // 2. Telefon
  if (targetPhone && !isValidPhone(targetPhone)) {
    errors.push('Telefon numarası yalnızca rakam ve telefon karakterleri (+, -, parantez) içerebilir ve en az 10 rakamdan oluşmalıdır.');
  }

  // 3. Ad & Soyad
  if (targetAd && !isValidName(targetAd)) {
    errors.push('Ad alanına rakam veya özel karakter girilemez.');
  }
  if (targetSoyad && !isValidName(targetSoyad)) {
    errors.push('Soyad alanına rakam veya özel karakter girilemez.');
  }

  // 4. Rol
  if (targetRole && (typeof targetRole !== 'string' || targetRole.trim() === '')) {
    errors.push('Geçersiz kullanıcı rolü seçildi.');
  }

  // 5. Durum
  if (targetStatus && !validStatuses.includes(targetStatus)) {
    errors.push('Geçersiz hesap durumu seçildi.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateUserCreate,
  validateUserUpdate,
  isValidEmail,
  isValidPhone,
  isValidName,
  isValidUsername,
  validRoles,
  validStatuses
};
