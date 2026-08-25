const { Tedarikci, SatinAlmaSiparisi, Kullanici, StokKarti, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class SupplierRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.durum = filters.status;
    }

    if (filters.search) {
      where[Op.or] = [
        { firmaAdi: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { tedarikciKodu: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { vergiNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { ilgiliKisi: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await Tedarikci.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ]
    });
  }

  async findById(id) {
    return await Tedarikci.findByPk(id, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ]
    });
  }

  async findByCode(code) {
    return await Tedarikci.findOne({ where: { tedarikciKodu: code } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      tedarikciKodu: data.tedarikciKodu || data.supplierCode,
      firmaAdi: data.firmaAdi || data.companyName,
      ticariAd: data.ticariAd || data.commercialName || null,
      vergiNo: data.vergiNo || data.taxNo || null,
      vergiDairesi: data.vergiDairesi || data.taxOffice || null,
      ilgiliKisi: data.ilgiliKisi || data.contactPerson || data.salesRepresentative || null,
      eposta: data.eposta || data.email || null,
      telefon: data.telefon || data.phone || null,
      gsm: data.gsm || data.mobilePhone || null,
      faks: data.faks || data.fax || null,
      webSitesi: data.webSitesi || data.website || null,
      bankaBilgileri: data.bankaBilgileri || data.bankAccountInfo || null,
      teslimatSekli: data.teslimatSekli || data.deliveryTerms || 'DAP - Adrese / Fabrikaya Teslim',
      terminSuresi: parseInt(data.terminSuresi || data.leadTimeDays || data.deliveryDays, 10) || 7,
      adres: data.adres || data.address || null,
      sehir: data.sehir || data.city || null,
      ulke: data.ulke || data.country || 'Türkiye',
      odemeVadesi: data.odemeVadesi || data.paymentTerm || 'Vadeli_30',
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      riskLimiti: data.riskLimiti !== undefined ? data.riskLimiti : (data.riskLimit || 100000),
      guncelBakiye: data.guncelBakiye !== undefined ? data.guncelBakiye : (data.currentBalance || 0),
      kategori: data.kategori || data.category || 'Hammadde',
      performansSkoru: data.performansSkoru !== undefined ? data.performansSkoru : (data.performanceScore !== undefined ? data.performanceScore : 85),
      zamanindaTeslimatOrani: data.zamanindaTeslimatOrani !== undefined ? data.zamanindaTeslimatOrani : (data.onTimeDeliveryRate || 95),
      kaliteSkoru: data.kaliteSkoru !== undefined ? data.kaliteSkoru : (data.qualityScore || 85),
      toplamSiparisSayisi: data.toplamSiparisSayisi !== undefined ? data.toplamSiparisSayisi : (data.totalOrderCount || 0),
      toplamHarcama: data.toplamHarcama !== undefined ? data.toplamHarcama : (data.totalSpend || 0),
      durum: data.durum || data.status || 'Active',
      notlar: data.notlar || data.notes || null,
      olusturanId: currentUser ? currentUser.id : null
    };

    const supplier = await Tedarikci.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'Tedarikci',
      varlikId: supplier.id,
      detaylar: { tedarikciKodu: supplier.tedarikciKodu, firmaAdi: supplier.firmaAdi },
      ipAdresi: ipAddress
    });

    return supplier;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const supplier = await Tedarikci.findByPk(id);
    if (!supplier) return null;

    const oldData = { firmaAdi: supplier.firmaAdi, durum: supplier.durum };
    await supplier.update(data);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'Tedarikci',
      varlikId: supplier.id,
      detaylar: { oldData, newData: data },
      ipAdresi: ipAddress
    });

    return supplier;
  }

  async getNextCode() {
    const year = new Date().getFullYear();
    const prefix = `TED-${year}-`;
    const last = await Tedarikci.findOne({
      where: { tedarikciKodu: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });
    if (!last) return `${prefix}0001`;
    const parts = last.tedarikciKodu.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalSuppliers = await Tedarikci.count();
    const activeSuppliers = await Tedarikci.count({ where: { durum: 'Active' } });
    const avgPerformance = await Tedarikci.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('performansSkoru')), 'avgScore']],
      where: { durum: 'Active' },
      raw: true
    });
    return {
      totalSuppliers,
      activeSuppliers,
      avgPerformance: avgPerformance ? parseFloat(avgPerformance.avgScore || 0).toFixed(1) : '0.0'
    };
  }

  async getSupplierWithOrders(id) {
    return await Tedarikci.findByPk(id, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        {
          model: SatinAlmaSiparisi, as: 'satinAlmaSiparisleri',
          include: [{ model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim'] }],
          order: [['createdAt', 'DESC']],
          limit: 20
        }
      ]
    });
  }
}

module.exports = new SupplierRepository();
