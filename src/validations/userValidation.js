const validRoles = [
  'Admin',
  'Stock_Manager',
  'Sales_Manager',
  'Purchase_Manager',
  'Production_Manager',
  'Quality_Manager',
  'Employee'
];

const validateUserCreate = (req) => {
  const { username, password, email, role } = req.body || {};
  const errors = [];

  if (!username || username.trim().length < 3) {
    errors.push('Kullanıcı adı en az 3 karakter olmalıdır.');
  }

  if (!password || password.length < 6) {
    errors.push('Şifre en az 6 karakter olmalıdır.');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Geçerli bir e-posta adresi giriniz.');
  }

  if (role && !validRoles.includes(role)) {
    errors.push('Geçersiz kullanıcı rolü seçildi.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateUserUpdate = (req) => {
  const { firstName, lastName, email, role, status } = req.body || {};
  const errors = [];

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push('Geçerli bir e-posta adresi giriniz.');
    }
  }

  if (role && !validRoles.includes(role)) {
    errors.push('Geçersiz kullanıcı rolü seçildi.');
  }

  const validStatuses = ['Active', 'Inactive', 'Suspended'];
  if (status && !validStatuses.includes(status)) {
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
  validRoles
};
