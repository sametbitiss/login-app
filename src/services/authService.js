const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');

class AuthService {
  async login(username, password) {
    const user = await userRepository.findByUsername(username);
    if (!user) {
      throw new Error('Kullanıcı bulunamadı');
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new Error('Hatalı şifre');
    }
    
    return user;
  }
}

module.exports = new AuthService();
