const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');

class AuthService {
  async login(username, password) {
    if (!username || !password) {
      throw new Error('Kullanıcı adı ve şifre girilmesi zorunludur.');
    }

    const user = await userRepository.findByUsername(username.trim());
    if (!user) {
      throw new Error('Girdiğiniz kullanıcı adı veya şifre hatalı.');
    }
    
    const isMatch = await bcrypt.compare(password, user.sifre || user.password);
    if (!isMatch) {
      throw new Error('Girdiğiniz kullanıcı adı veya şifre hatalı.');
    }

    const userStatus = user.durum || user.status;
    if (userStatus && userStatus !== 'Active') {
      throw new Error('Hesabınız dondurulmuş veya pasife alınmıştır. Lütfen yönetici ile iletişime geçin.');
    }
    
    return user;
  }
}

module.exports = new AuthService();
