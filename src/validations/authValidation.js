const validateSendCode = (req) => {
  const { username, password } = req.body || {};
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    errors.push('Kullanıcı adı boş bırakılamaz.');
  }

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push('Şifre boş bırakılamaz.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

const validateVerifyCode = (req) => {
  const { code } = req.body || {};
  const errors = [];

  if (!code || typeof code !== 'string' || code.trim().length !== 6 || !/^\d{6}$/.test(code.trim())) {
    errors.push('Lütfen 6 haneli sayısal doğrulama kodunu eksiksiz giriniz.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateSendCode,
  validateVerifyCode,
  validateLogin: validateSendCode
};
