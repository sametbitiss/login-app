const { SatinAlmaTeklifTalebi, Kullanici, StokKarti, Tedarikci, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class RfqRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.durum = filters.status;
    }
    if (filters.search) {
      where[Op.or] = [
        { teklifTalepNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { tedarikciAdi: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await SatinAlmaTeklifTalebi.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim'] },
        { model: Tedarikci, as: 'tedarikci', attributes: ['id', 'tedarikciKodu', 'firmaAdi', 'performansSkoru', 'kaliteSkoru', 'sehir'] }
      ]
    });
  }

  async findById(id) {
    return await SatinAlmaTeklifTalebi.findByPk(id, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti' },
        { model: Tedarikci, as: 'tedarikci' }
      ]
    });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      teklifTalepNo: data.teklifTalepNo || data.rfqNo,
      tedarikciId: data.tedarikciId || data.supplierId,
      tedarikciAdi: data.tedarikciAdi || data.supplierName,
      stokId: data.stokId || data.stockItemId,
      talepEdilenMiktar: data.talepEdilenMiktar !== undefined ? data.talepEdilenMiktar : (data.requestedQuantity || 1),
      teklifEdilenBirimFiyat: data.teklifEdilenBirimFiyat !== undefined ? data.teklifEdilenBirimFiyat : data.offeredUnitPrice,
      teklifEdilenToplamFiyat: data.teklifEdilenToplamFiyat !== undefined ? data.teklifEdilenToplamFiyat : data.offeredTotalPrice,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      teslimSuresiGun: data.teslimSuresiGun !== undefined ? data.teslimSuresiGun : data.deliveryDays,
      odemeVadesi: data.odemeVadesi || data.paymentTerm,
      gecerlilikBitis: data.gecerlilikBitis || data.validUntil,
      kaliteNotu: data.kaliteNotu || data.qualityNote,
      durum: data.durum || data.status || 'Draft',
      kazananMi: data.kazananMi !== undefined ? data.kazananMi : (data.isWinner || false),
      notlar: data.notlar || data.notes,
      teklifTalepTarihi: data.teklifTalepTarihi || data.rfqDate || new Date().toISOString().split('T')[0],
      teslimYeri: data.teslimYeri || data.deliveryPlace,
      sevkiyatDurumu: data.sevkiyatDurumu || data.shippingStatus,
      kdvDurumu: data.kdvDurumu || data.vatStatus,
      belgeReferansi: data.belgeReferansi || data.documentRef,
      araToplam: data.araToplam !== undefined ? data.araToplam : data.subtotal,
      toplamIskonto: data.toplamIskonto !== undefined ? data.toplamIskonto : data.totalDiscount,
      toplamKdv: data.toplamKdv !== undefined ? data.toplamKdv : data.totalTax,
      kalemlerVerisi: data.kalemlerVerisi || data.itemsData,
      talepEden: data.talepEden || data.requestedBy,
      olusturanId: currentUser ? currentUser.id : null
    };

    const rfq = await SatinAlmaTeklifTalebi.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatinAlmaTeklifTalebi',
      varlikId: rfq.id,
      detaylar: { teklifTalepNo: rfq.teklifTalepNo, tedarikciAdi: rfq.tedarikciAdi },
      ipAdresi: ipAddress
    });

    return rfq;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const rfq = await SatinAlmaTeklifTalebi.findByPk(id);
    if (!rfq) return null;

    await rfq.update(data);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'SatinAlmaTeklifTalebi',
      varlikId: rfq.id,
      detaylar: data,
      ipAdresi: ipAddress
    });

    return rfq;
  }

  async getNextRfqNo() {
    const year = new Date().getFullYear();
    const prefix = `RFQ-${year}-`;
    const last = await SatinAlmaTeklifTalebi.findOne({
      where: { teklifTalepNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });
    if (!last) return `${prefix}0001`;
    const parts = last.teklifTalepNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalRfqs = await SatinAlmaTeklifTalebi.count();
    const pendingRfqs = await SatinAlmaTeklifTalebi.count({ where: { durum: { [Op.in]: ['Draft', 'Sent'] } } });
    const acceptedRfqs = await SatinAlmaTeklifTalebi.count({ where: { durum: 'Accepted' } });
    return { totalRfqs, pendingRfqs, acceptedRfqs };
  }
}

module.exports = new RfqRepository();
