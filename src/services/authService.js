'use strict';
const bcrypt = require('bcrypt');
const userRepository = require('../repositories/userRepository');
const emailService = require('./emailService');
const logger = require('../utils/logger');

class AuthService {
  /**
   * E-posta adresini kullanıcı gizliliği için maskeler (Örn: s***s@gmail.com)
   */
  maskEmail(email) {
    if (!email || typeof email !== 'string') return '—';
    const parts = email.split('@');
    if (parts.length !== 2) return email;
    const name = parts[0];
    const domain = parts[1];
    if (name.length <= 2) {
      return `${name[0]}*@${domain}`;
    }
    return `${name[0]}${'*'.repeat(Math.max(3, name.length - 2))}${name[name.length - 1]}@${domain}`;
  }

  /**
   * Kullanıcı adı ve şifreyi doğrular, geçerliyse 6 haneli doğrulama kodu üretip e-postaya gönderir.
   * Kod veritabanında yalnızca 1 dakika (60 saniye) geçerli tutulur.
   */
  async sendVerificationCode(username, password = null, ip = null, isResend = false) {
    if (!username || !username.trim()) {
      throw new Error('Lütfen kullanıcı adınızı giriniz.');
    }

    const cleanUsername = username.trim();
    let user = await userRepository.findByUsername(cleanUsername);

    // Kullanıcı adı bulunamazsa e-posta ile arama yap
    if (!user && cleanUsername.includes('@')) {
      user = await userRepository.findByEmail(cleanUsername);
    }

    if (!user) {
      throw new Error('Girdiğiniz kullanıcı adı veya şifre hatalı.');
    }

    // Eğer yeniden kod gönderimi (resend) değilse şifre kontrolü yap
    if (!isResend) {
      if (!password) {
        throw new Error('Lütfen şifrenizi giriniz.');
      }
      const isMatch = await bcrypt.compare(password, user.sifre || user.password);
      if (!isMatch) {
        throw new Error('Girdiğiniz kullanıcı adı veya şifre hatalı.');
      }
    }

    const userStatus = user.durum || user.status;
    if (userStatus && userStatus !== 'Active') {
      throw new Error('Hesabınız dondurulmuş veya pasife alınmıştır. Lütfen sistem yöneticiniz ile iletişime geçiniz.');
    }

    if (!user.eposta || !user.eposta.trim()) {
      throw new Error('Bu kullanıcı hesabına tanımlı geçerli bir e-posta adresi bulunamadı. Lütfen sistem yöneticinize başvurunuz.');
    }

    // 6 Haneli Sayısal Güvenlik Kodu Üretimi (100000 - 999999)
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 1 Dakika (60 Saniye) Geçerlilik Süresi
    const expiryDate = new Date(Date.now() + 60 * 1000);

    // Veritabanına kod ve son kullanma tarihini kaydet
    await user.update({
      dogrulamaKodu: code,
      dogrulamaKoduSonKullanma: expiryDate
    });

    const displayName = (user.ad && user.soyad) ? `${user.ad} ${user.soyad}` : user.kullaniciAdi;

    // Gerçek e-posta gönderimi
    await emailService.sendOtpEmail({
      to: user.eposta.trim(),
      code,
      fullName: displayName,
      username: user.kullaniciAdi
    });

    logger.security(`Doğrulama Kodu Üretildi ve Gönderildi: ${user.kullaniciAdi} (${this.maskEmail(user.eposta)})`, { ip });

    return {
      userId: user.id,
      username: user.kullaniciAdi,
      email: user.eposta,
      maskedEmail: this.maskEmail(user.eposta),
      expiresIn: 60 // saniye cinsinden
    };
  }

  /**
   * Kullanıcının girdiği 6 haneli doğrulama kodunu denetler.
   */
  async verifyCode(userId, inputCode, ip = null) {
    if (!userId) {
      throw new Error('Geçersiz doğrulama oturumu. Lütfen kullanıcı adınızı ve şifrenizi tekrar giriniz.');
    }

    if (!inputCode || String(inputCode).trim().length !== 6) {
      throw new Error('Lütfen e-posta adresinize gelen 6 haneli doğrulama kodunu eksiksiz giriniz.');
    }

    const cleanCode = String(inputCode).trim();
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new Error('Kullanıcı hesabı bulunamadı.');
    }

    const userStatus = user.durum || user.status;
    if (userStatus && userStatus !== 'Active') {
      throw new Error('Hesabınız aktif değildir.');
    }

    if (!user.dogrulamaKodu || !user.dogrulamaKoduSonKullanma) {
      throw new Error('Aktif bir doğrulama kodu bulunamadı veya kodun süresi doldu. Lütfen tekrar kod talep ediniz.');
    }

    const now = new Date();
    const expiry = new Date(user.dogrulamaKoduSonKullanma);

    // 1 Dakikalık Süre Kontrolü
    if (now > expiry) {
      // Süresi dolan kodu veritabanından temizle
      await user.update({
        dogrulamaKodu: null,
        dogrulamaKoduSonKullanma: null
      });
      throw new Error('Doğrulama kodunun 1 dakikalık kullanım süresi dolmuştur. Lütfen "Tekrar Kod Gönder" butonuna basınız.');
    }

    // Kod Eşleşme Kontrolü
    if (user.dogrulamaKodu.trim() !== cleanCode) {
      logger.security(`Hatalı Doğrulama Kodu Girişi: ${user.kullaniciAdi} - Girilen: ${cleanCode}`, { ip });
      throw new Error('Girdiğiniz 6 haneli doğrulama kodu hatalıdır. Lütfen kontrol edip tekrar deneyiniz.');
    }

    // Başarılı Giriş: Kodu tek kullanımlık olduğu için veritabanından anında sil
    await user.update({
      dogrulamaKodu: null,
      dogrulamaKoduSonKullanma: null
    });

    logger.security(`Doğrulama Kodu Başarıyla Onaylandı ve Kullanıcı Giriş Yaptı: ${user.kullaniciAdi}`, { ip });

    return user;
  }
}

module.exports = new AuthService();
