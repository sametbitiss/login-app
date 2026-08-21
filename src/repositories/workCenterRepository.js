const { IsMerkezi, Atolye, Kullanici } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class WorkCenterRepository {
  async findAll(filters = {}) {
    const where = {};
    if (filters.status) where.durum = filters.status;
    if (filters.atolyeId) where.atolyeId = parseInt(filters.atolyeId, 10);

    if (filters.search) {
      where[Op.or] = [
        { isMerkeziKodu: { [Op.iLike]: `%${filters.search}%` } },
        { isMerkeziAdi: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    return await IsMerkezi.findAll({
      where,
      include: [
        {
          model: Atolye,
          as: 'atolye',
          include: [
            {
              model: Kullanici,
              as: 'sorumlu',
              attributes: ['id', 'kullaniciAdi', 'ad', 'soyad', 'departman', 'unvan']
            }
          ]
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
    return await IsMerkezi.findByPk(id, {
      include: [
        {
          model: Atolye,
          as: 'atolye',
          include: [
            {
              model: Kullanici,
              as: 'sorumlu',
              attributes: ['id', 'kullaniciAdi', 'ad', 'soyad', 'departman', 'unvan']
            }
          ]
        },
        {
          model: Kullanici,
          as: 'olusturan',
          attributes: ['id', 'kullaniciAdi', 'ad', 'soyad']
        }
      ]
    });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const newWorkCenter = await IsMerkezi.create({
      isMerkeziKodu: data.isMerkeziKodu.trim(),
      isMerkeziAdi: data.isMerkeziAdi.trim(),
      atolyeId: parseInt(data.atolyeId, 10),
      gunlukCalismaSaati: parseFloat(data.gunlukCalismaSaati) || 8.00,
      durum: data.durum || 'Active',
      varsayilanIsciSayisi: data.varsayilanIsciSayisi ? parseInt(data.varsayilanIsciSayisi, 10) : null,
      olusturanId: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'IsMerkezi',
      varlikId: newWorkCenter.id,
      detaylar: { isMerkeziKodu: newWorkCenter.isMerkeziKodu, isMerkeziAdi: newWorkCenter.isMerkeziAdi, atolyeId: newWorkCenter.atolyeId },
      ipAdresi: ipAddress
    });

    return newWorkCenter;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const workCenter = await IsMerkezi.findByPk(id);
    if (!workCenter) return null;

    await workCenter.update({
      isMerkeziKodu: data.isMerkeziKodu !== undefined ? data.isMerkeziKodu.trim() : workCenter.isMerkeziKodu,
      isMerkeziAdi: data.isMerkeziAdi !== undefined ? data.isMerkeziAdi.trim() : workCenter.isMerkeziAdi,
      atolyeId: data.atolyeId !== undefined ? parseInt(data.atolyeId, 10) : workCenter.atolyeId,
      gunlukCalismaSaati: data.gunlukCalismaSaati !== undefined ? parseFloat(data.gunlukCalismaSaati) : workCenter.gunlukCalismaSaati,
      durum: data.durum !== undefined ? data.durum : workCenter.durum,
      varsayilanIsciSayisi: data.varsayilanIsciSayisi !== undefined ? (data.varsayilanIsciSayisi ? parseInt(data.varsayilanIsciSayisi, 10) : null) : workCenter.varsayilanIsciSayisi
    });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'IsMerkezi',
      varlikId: workCenter.id,
      detaylar: { isMerkeziKodu: workCenter.isMerkeziKodu, isMerkeziAdi: workCenter.isMerkeziAdi, atolyeId: workCenter.atolyeId },
      ipAdresi: ipAddress
    });

    return workCenter;
  }

  async delete(id, currentUser = null, ipAddress = null) {
    const workCenter = await IsMerkezi.findByPk(id);
    if (!workCenter) return null;

    await workCenter.destroy();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'IsMerkezi',
      varlikId: id,
      detaylar: { isMerkeziKodu: workCenter.isMerkeziKodu, isMerkeziAdi: workCenter.isMerkeziAdi },
      ipAdresi: ipAddress
    });

    return true;
  }

  async getStats() {
    const all = await IsMerkezi.findAll({ attributes: ['id', 'durum', 'gunlukCalismaSaati'] });
    const total = all.length;
    const active = all.filter(w => w.durum === 'Active').length;
    const inactive = all.filter(w => w.durum === 'Inactive').length;
    const totalCapacityHours = all
      .filter(w => w.durum === 'Active')
      .reduce((sum, w) => sum + (parseFloat(w.gunlukCalismaSaati) || 0), 0);

    return { total, active, inactive, totalCapacityHours };
  }
}

module.exports = new WorkCenterRepository();
