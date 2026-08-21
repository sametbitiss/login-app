const { Atolye, Kullanici, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class WorkshopRepository {
  async generateWorkshopCode() {
    const year = new Date().getFullYear();
    const prefix = `ATY-${year}-`;
    const lastWorkshop = await Atolye.findOne({
      where: { atolyeKodu: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastWorkshop) return `${prefix}0001`;

    const lastNo = lastWorkshop.atolyeKodu.replace(prefix, '');
    const nextSeq = (parseInt(lastNo, 10) || 0) + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async findAll(filters = {}) {
    const where = {};
    if (filters.status) where.durum = filters.status;

    if (filters.search) {
      where[Op.or] = [
        { atolyeKodu: { [Op.iLike]: `%${filters.search}%` } },
        { atolyeAdi: { [Op.iLike]: `%${filters.search}%` } },
        { aciklama: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    return await Atolye.findAll({
      where,
      include: [
        {
          model: Kullanici,
          as: 'sorumlu',
          attributes: ['id', 'kullaniciAdi', 'ad', 'soyad', 'departman', 'unvan', 'eposta', 'telefon', 'rol']
        },
        {
          model: Kullanici,
          as: 'olusturan',
          attributes: ['id', 'kullaniciAdi', 'ad', 'soyad']
        }
      ],
      order: [['id', 'DESC']]
    });
  }

  async findById(id) {
    return await Atolye.findByPk(id, {
      include: [
        {
          model: Kullanici,
          as: 'sorumlu',
          attributes: ['id', 'kullaniciAdi', 'ad', 'soyad', 'departman', 'unvan', 'eposta', 'telefon', 'rol']
        },
        {
          model: Kullanici,
          as: 'olusturan',
          attributes: ['id', 'kullaniciAdi', 'ad', 'soyad']
        }
      ]
    });
  }

  async getEligiblePersonnel(search = '') {
    const where = {
      durum: 'Active',
      unvan: { [Op.iLike]: 'Personel' },
      rol: { [Op.notIn]: ['Admin', 'Sistem_Admin'] }
    };

    if (search) {
      where[Op.and] = [
        {
          [Op.or]: [
            { ad: { [Op.iLike]: `%${search}%` } },
            { soyad: { [Op.iLike]: `%${search}%` } },
            { kullaniciAdi: { [Op.iLike]: `%${search}%` } },
            { departman: { [Op.iLike]: `%${search}%` } }
          ]
        }
      ];
    }

    return await Kullanici.findAll({
      where,
      attributes: ['id', 'kullaniciAdi', 'ad', 'soyad', 'departman', 'unvan', 'eposta', 'telefon', 'rol'],
      order: [['ad', 'ASC'], ['soyad', 'ASC']]
    });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const atolyeKodu = data.atolyeKodu || (await this.generateWorkshopCode());

    const newWorkshop = await Atolye.create({
      atolyeKodu,
      atolyeAdi: data.atolyeAdi,
      sorumluId: parseInt(data.sorumluId, 10),
      durum: data.durum || 'Active',
      aciklama: data.aciklama || null,
      olusturanId: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'Atolye',
      varlikId: newWorkshop.id,
      detaylar: { atolyeKodu: newWorkshop.atolyeKodu, atolyeAdi: newWorkshop.atolyeAdi, sorumluId: newWorkshop.sorumluId },
      ipAdresi: ipAddress
    });

    return newWorkshop;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const workshop = await Atolye.findByPk(id);
    if (!workshop) return null;

    await workshop.update({
      atolyeKodu: data.atolyeKodu !== undefined ? data.atolyeKodu : workshop.atolyeKodu,
      atolyeAdi: data.atolyeAdi !== undefined ? data.atolyeAdi : workshop.atolyeAdi,
      sorumluId: data.sorumluId !== undefined ? parseInt(data.sorumluId, 10) : workshop.sorumluId,
      durum: data.durum !== undefined ? data.durum : workshop.durum,
      aciklama: data.aciklama !== undefined ? data.aciklama : workshop.aciklama
    });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'Atolye',
      varlikId: workshop.id,
      detaylar: { atolyeKodu: workshop.atolyeKodu, atolyeAdi: workshop.atolyeAdi, sorumluId: workshop.sorumluId },
      ipAdresi: ipAddress
    });

    return workshop;
  }

  async delete(id, currentUser = null, ipAddress = null) {
    const workshop = await Atolye.findByPk(id);
    if (!workshop) return null;

    await workshop.destroy();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'Atolye',
      varlikId: id,
      detaylar: { atolyeKodu: workshop.atolyeKodu, atolyeAdi: workshop.atolyeAdi },
      ipAdresi: ipAddress
    });

    return true;
  }

  async getStats() {
    const all = await Atolye.findAll({ attributes: ['id', 'durum', 'sorumluId'] });
    const total = all.length;
    const active = all.filter(w => w.durum === 'Active').length;
    const inactive = all.filter(w => w.durum === 'Inactive').length;
    const uniqueManagers = new Set(all.map(w => w.sorumluId)).size;

    return { total, active, inactive, uniqueManagers };
  }
}

module.exports = new WorkshopRepository();
