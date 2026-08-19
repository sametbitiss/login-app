const { Kullanici, SistemAyari } = require('../../models');
const logService = require('../services/logService');
const bcrypt = require('bcrypt');

class UserRepository {
  async findByUsername(kullaniciAdi) {
    return await Kullanici.findOne({ where: { kullaniciAdi } });
  }

  async findAll() {
    return await Kullanici.findAll({
      attributes: ['id', 'kullaniciAdi', 'eposta', 'ad', 'soyad', 'telefon', 'departman', 'unvan', 'rol', 'durum', 'createdAt', 'updatedAt'],
      order: [['id', 'ASC']]
    });
  }

  async findById(id) {
    return await Kullanici.findByPk(id);
  }

  async create(userData, currentUser = null, ipAddress = null) {
    const newUser = await Kullanici.create(userData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : newUser.id,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : newUser.kullaniciAdi,
      islem: 'CREATE',
      varlik: 'Kullanici',
      varlikId: newUser.id,
      detaylar: { kullaniciAdi: newUser.kullaniciAdi, eposta: newUser.eposta, rol: newUser.rol, departman: newUser.departman, durum: newUser.durum },
      ipAdresi: ipAddress
    });

    return newUser;
  }

  async updateUser(id, updateData, currentUser = null, ipAddress = null) {
    const user = await Kullanici.findByPk(id);
    if (!user) return null;

    const oldData = {
      ad: user.ad,
      soyad: user.soyad,
      eposta: user.eposta,
      telefon: user.telefon,
      departman: user.departman,
      unvan: user.unvan,
      rol: user.rol,
      durum: user.durum
    };

    await user.update(updateData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'Kullanici',
      varlikId: user.id,
      detaylar: { oldData, newData: updateData },
      ipAdresi: ipAddress
    });

    return user;
  }

  async updateRole(id, newRole, currentUser = null, ipAddress = null) {
    const user = await Kullanici.findByPk(id);
    if (!user) return null;

    const oldRole = user.rol;
    user.rol = newRole;
    await user.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'Kullanici',
      varlikId: user.id,
      detaylar: { field: 'rol', oldRole, newRole },
      ipAdresi: ipAddress
    });

    return user;
  }

  async toggleStatus(id, newStatus, currentUser = null, ipAddress = null) {
    const user = await Kullanici.findByPk(id);
    if (!user) return null;

    const oldStatus = user.durum;
    user.durum = newStatus;
    await user.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'Kullanici',
      varlikId: user.id,
      detaylar: { field: 'durum', oldStatus, newStatus },
      ipAdresi: ipAddress
    });

    return user;
  }

  async resetPassword(id, rawPassword, currentUser = null, ipAddress = null) {
    const user = await Kullanici.findByPk(id);
    if (!user) return null;

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    user.sifre = hashedPassword;
    await user.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'Kullanici',
      varlikId: user.id,
      detaylar: { action: 'Password Reset' },
      ipAdresi: ipAddress
    });

    return user;
  }

  async deleteUser(id, currentUser = null, ipAddress = null) {
    const user = await Kullanici.findByPk(id);
    if (!user) return false;

    const deletedUsername = user.kullaniciAdi;
    await user.destroy();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'Kullanici',
      varlikId: id,
      detaylar: { kullaniciAdi: deletedUsername },
      ipAdresi: ipAddress
    });

    return true;
  }

  // --- SYSTEM SETTINGS ---
  async getAllSettings() {
    return await SistemAyari.findAll({ order: [['kategori', 'ASC'], ['anahtar', 'ASC']] });
  }

  async updateSettings(settingsData, currentUser = null, ipAddress = null) {
    for (const [key, value] of Object.entries(settingsData)) {
      const setting = await SistemAyari.findOne({ where: { anahtar: key } });
      if (setting) {
        setting.deger = String(value);
        await setting.save();
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'SistemAyari',
      varlikId: 'All',
      detaylar: settingsData,
      ipAdresi: ipAddress
    });
  }

  async getPermissionMatrix() {
    const { DEFAULT_ROLE_MATRIX } = require('../config/permissionMatrix');
    const setting = await SistemAyari.findOne({ where: { anahtar: 'role_permission_matrix' } });
    if (setting && setting.deger) {
      try {
        return JSON.parse(setting.deger);
      } catch (e) {}
    }
    return DEFAULT_ROLE_MATRIX;
  }

  async savePermissionMatrix(matrix, currentUser = null, ipAddress = null) {
    let setting = await SistemAyari.findOne({ where: { anahtar: 'role_permission_matrix' } });
    const val = JSON.stringify(matrix);
    if (setting) {
      setting.deger = val;
      await setting.save();
    } else {
      await SistemAyari.create({
        anahtar: 'role_permission_matrix',
        deger: val,
        aciklama: 'Rol ve yetki matrisi tanımı',
        kategori: 'Security'
      });
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'SistemAyari',
      varlikId: 'role_permission_matrix',
      detaylar: { action: 'Updated Role Permission Matrix' },
      ipAdresi: ipAddress
    });
  }
}

module.exports = new UserRepository();
