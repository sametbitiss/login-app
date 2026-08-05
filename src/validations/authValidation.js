const validateLogin = (req) => {
  const { username, password } = req.body || {};
  const errors = [];

  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    errors.push('Kullanıcı adı boş bırakılamaz.');
  }

  if (!password || typeof password !== 'string' || password.trim().length === 0) {
    errors.push('Parola boş bırakılamaz.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

module.exports = {
  validateLogin
};
