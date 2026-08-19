const { SatisTeklifi, StokKarti, MusteriHesabi, Kullanici } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class QuotationRepository {
  async findAll({ search, status } = {}) {
    const where = {};
    if (status && status !== '') where.durum = status;
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { teklifNo: { [Op.iLike]: s } },
        { musteriAdi: { [Op.iLike]: s } }
      ];
    }

    return await SatisTeklifi.findAll({
      where,
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: MusteriHesabi, as: 'musteri' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SatisTeklifi.findByPk(id, {
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: MusteriHesabi, as: 'musteri' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ]
    });
  }

  async getNextQuotationNo() {
    const last = await SatisTeklifi.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'TEK-2026-0001';
    const num = last.id + 1;
    return `TEK-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const safeInt = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return null;
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? null : n;
    };
    const safeFloat = (val, defaultVal = 0) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return defaultVal;
      const n = parseFloat(val);
      return Number.isNaN(n) ? defaultVal : n;
    };

    const musteriId = safeInt(data.musteriId || data.customerId);
    const stokId = safeInt(data.stokId || data.stockItemId);
    const iskontoOrani = safeFloat(data.iskontoOrani !== undefined ? data.iskontoOrani : data.discountRate, 0);
    const toplamTutar = safeFloat(data.toplamTutar !== undefined ? data.toplamTutar : data.totalAmount, 0);
    const onayGerekli = data.onayGerekli !== undefined ? data.onayGerekli : (data.approvalNeeded !== undefined ? data.approvalNeeded : (iskontoOrani > 20 || toplamTutar > 100000));
    const durum = (data.durum || data.status) ? (data.durum || data.status) : (onayGerekli ? 'Pending_Approval' : 'Approved');

    const cleanData = {
      teklifNo: data.teklifNo || data.quotationNo,
      musteriId,
      musteriAdi: data.musteriAdi || data.customerName,
      teklifTarihi: data.teklifTarihi || data.quotationDate || new Date().toISOString().split('T')[0],
      gecerlilikBitis: data.gecerlilikBitis || data.validUntil,
      stokId,
      kalemlerJson: data.kalemlerJson || data.itemsJson,
      miktar: safeFloat(data.miktar !== undefined ? data.miktar : data.quantity, 1),
      birimFiyat: safeFloat(data.birimFiyat !== undefined ? data.birimFiyat : data.unitPrice, 0),
      iskontoOrani,
      kdvOrani: safeFloat(data.kdvOrani !== undefined ? data.kdvOrani : data.taxRate, 20),
      araToplam: safeFloat(data.araToplam !== undefined ? data.araToplam : data.subtotal, 0),
      iskontoTutari: safeFloat(data.iskontoTutari !== undefined ? data.iskontoTutari : data.discountAmount, 0),
      kdvTutari: safeFloat(data.kdvTutari !== undefined ? data.kdvTutari : data.taxAmount, 0),
      toplamTutar,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      durum,
      onayGerekli,
      onayNedeni: data.onayNedeni || data.approvalReason,
      yoneticiNotlari: data.yoneticiNotlari || data.managerNotes,
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    const quotation = await SatisTeklifi.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatisTeklifi',
      varlikId: quotation.id,
      detaylar: { teklifNo: quotation.teklifNo, musteriAdi: quotation.musteriAdi },
      ipAdresi: ipAddress
    });

    return quotation;
  }

  async updateStatus(id, durum, yoneticiNotlari = null, currentUser = null, ipAddress = null) {
    const quote = await SatisTeklifi.findByPk(id);
    if (!quote) return null;

    quote.durum = durum;
    if (yoneticiNotlari) quote.yoneticiNotlari = yoneticiNotlari;
    await quote.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE_STATUS',
      varlik: 'SatisTeklifi',
      varlikId: quote.id,
      detaylar: { durum, yoneticiNotlari },
      ipAdresi: ipAddress
    });

    return quote;
  }
}

module.exports = new QuotationRepository();
