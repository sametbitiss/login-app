const { SatinAlmaTalebi, StokKarti, Kullanici } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class RequisitionRepository {
  async generateRequisitionNo() {
    const year = new Date().getFullYear();
    const prefix = `TALEP-${year}-`;
    const reqs = await SatinAlmaTalebi.findAll({
      where: { talepNo: { [Op.like]: `${prefix}%` } },
      attributes: ['talepNo']
    });

    let maxSeq = 0;
    reqs.forEach(r => {
      const numStr = r.talepNo.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    while (await SatinAlmaTalebi.findOne({ where: { talepNo: candidate } })) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    return candidate;
  }

  async findAll(filters = {}) {
    const where = {};
    if (filters.sourceModule) where.kaynakModul = filters.sourceModule;
    if (filters.status) where.durum = filters.status;

    return await SatinAlmaTalebi.findAll({
      where,
      include: [
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim', 'kategori', 'depoLokasyonu', 'mevcutStok', 'alisFiyati', 'paraBirimi', 'tedarikci'] },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async create(reqData, currentUser = null, ipAddress = null) {
    let newReq = null;
    let attempts = 0;

    const cleanData = {
      talepNo: reqData.talepNo || reqData.requisitionNo,
      kaynakModul: reqData.kaynakModul || reqData.sourceModule || 'Stock',
      stokId: reqData.stokId || reqData.stockItemId,
      talepEdilenMiktar: reqData.talepEdilenMiktar !== undefined ? reqData.talepEdilenMiktar : (reqData.requestedQuantity || 1.0),
      birim: reqData.birim || reqData.unit || 'Adet',
      aciliyet: reqData.aciliyet || reqData.urgency || 'Normal',
      durum: reqData.durum || reqData.status || 'Pending',
      talepEdenAdi: reqData.talepEdenAdi || reqData.requesterName || (currentUser ? (currentUser.ad ? `${currentUser.ad} ${currentUser.soyad}` : currentUser.kullaniciAdi) : 'Sistem'),
      notlar: reqData.notlar || reqData.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    while (!newReq && attempts < 10) {
      attempts++;
      cleanData.talepNo = await this.generateRequisitionNo();
      try {
        newReq = await SatinAlmaTalebi.create(cleanData);
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError' && attempts < 10) {
          continue;
        }
        throw err;
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE_REQUISITION',
      varlik: 'SatinAlmaTalebi',
      varlikId: newReq.id,
      detaylar: { talepNo: newReq.talepNo, kaynakModul: newReq.kaynakModul, stokId: newReq.stokId, talepEdilenMiktar: newReq.talepEdilenMiktar },
      ipAdresi: ipAddress
    });

    return newReq;
  }

  async getNextRequisitionNo() {
    return await this.generateRequisitionNo();
  }

  async updateStatus(id, durum, currentUser = null, ipAddress = null) {
    const req = await SatinAlmaTalebi.findByPk(id);
    if (!req) return null;

    req.durum = durum;
    await req.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE_REQUISITION_STATUS',
      varlik: 'SatinAlmaTalebi',
      varlikId: req.id,
      detaylar: { newStatus: durum },
      ipAdresi: ipAddress
    });

    return req;
  }
}

module.exports = new RequisitionRepository();
