const { SatinAlmaFaturasi, SatinAlmaSiparisi, Tedarikci, Kullanici } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class PurchaseInvoiceRepository {
  async findAll({ search } = {}) {
    const where = {};
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { faturaNo: { [Op.iLike || Op.like]: s } },
        { tedarikciAdi: { [Op.iLike || Op.like]: s } },
        { siparisNo: { [Op.iLike || Op.like]: s } }
      ];
    }

    return await SatinAlmaFaturasi.findAll({
      where,
      include: [
        { model: SatinAlmaSiparisi, as: 'satinAlmaSiparisi' },
        { model: Tedarikci, as: 'tedarikci' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SatinAlmaFaturasi.findByPk(id, {
      include: [
        { model: SatinAlmaSiparisi, as: 'satinAlmaSiparisi' },
        { model: Tedarikci, as: 'tedarikci' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ]
    });
  }

  async findByOrderId(satinAlmaSiparisId) {
    return await SatinAlmaFaturasi.findOne({
      where: { satinAlmaSiparisId }
    });
  }

  async findByInvoiceNo(faturaNo) {
    if (!faturaNo) return null;
    return await SatinAlmaFaturasi.findOne({
      where: { faturaNo }
    });
  }

  async getNextInvoiceNo() {
    const invoices = await SatinAlmaFaturasi.findAll({
      attributes: ['faturaNo'],
      raw: true
    });

    let maxNum = 0;
    const year = new Date().getFullYear();
    const prefix = `SAT-FAT-${year}-`;

    for (const inv of invoices) {
      if (inv.faturaNo && inv.faturaNo.startsWith(prefix)) {
        const parts = inv.faturaNo.split('-');
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `${prefix}${nextNum.toString().padStart(4, '0')}`;

    while (await SatinAlmaFaturasi.findOne({ where: { faturaNo: candidate } })) {
      nextNum++;
      candidate = `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    return candidate;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      faturaNo: data.faturaNo || data.invoiceNo,
      satinAlmaSiparisId: data.satinAlmaSiparisId || data.purchaseOrderId,
      tedarikciId: data.tedarikciId || data.supplierId,
      tedarikciAdi: data.tedarikciAdi || data.supplierName,
      tedarikciVergiDairesi: data.tedarikciVergiDairesi || data.supplierTaxOffice,
      tedarikciVergiNo: data.tedarikciVergiNo || data.supplierTaxNo,
      faturaAdresi: data.faturaAdresi || data.billingAddress,
      tedarikciTelefon: data.tedarikciTelefon || data.supplierPhone,
      tedarikciEposta: data.tedarikciEposta || data.supplierEmail,
      faturaTarihi: data.faturaTarihi || data.invoiceDate,
      faturaSaati: data.faturaSaati || data.invoiceTime || '10:30:00',
      faturaTuru: data.faturaTuru || data.invoiceType || 'SATIN_ALMA',
      siparisNo: data.siparisNo || data.orderNo,
      siparisTarihi: data.siparisTarihi || data.orderDate,
      irsaliyeNo: data.irsaliyeNo || data.dispatchNo,
      irsaliyeTarihi: data.irsaliyeTarihi || data.dispatchDate,
      bankaAdi: data.bankaAdi || data.bankName,
      ibanNo: data.ibanNo || data.ibanNo,
      araToplam: data.araToplam !== undefined ? data.araToplam : data.subtotal,
      iskontoTutari: data.iskontoTutari !== undefined ? data.iskontoTutari : data.discountAmount,
      kdvTutari: data.kdvTutari !== undefined ? data.kdvTutari : data.taxAmount,
      toplamTutar: data.toplamTutar !== undefined ? data.toplamTutar : data.totalAmount,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      odemeVadesi: data.odemeVadesi || data.paymentTerm,
      odemeDurumu: data.odemeDurumu || data.paymentStatus || 'Unpaid',
      durum: data.durum || data.status || 'Issued',
      kalemlerJson: data.kalemlerJson || data.itemsJson,
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    const invoice = await SatinAlmaFaturasi.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatinAlmaFaturasi',
      varlikId: invoice.id,
      detaylar: { faturaNo: invoice.faturaNo, toplamTutar: invoice.toplamTutar, tedarikciAdi: invoice.tedarikciAdi },
      ipAdresi: ipAddress
    });

    return invoice;
  }
}

module.exports = new PurchaseInvoiceRepository();
