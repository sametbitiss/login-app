const { SatisFaturasi, SatisSiparisi, SatisIrsaliyesi, MusteriHesabi, Kullanici } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');
const customerRepository = require('./customerRepository');

class InvoiceRepository {
  async findAll({ search } = {}) {
    const where = {};
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { faturaNo: { [Op.iLike]: s } },
        { musteriAdi: { [Op.iLike]: s } }
      ];
    }

    return await SatisFaturasi.findAll({
      where,
      include: [
        { model: SatisSiparisi, as: 'satisSiparisi' },
        { model: SatisIrsaliyesi, as: 'satisIrsaliyesi' },
        { model: MusteriHesabi, as: 'musteri' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SatisFaturasi.findByPk(id, {
      include: [
        { model: SatisSiparisi, as: 'satisSiparisi' },
        { model: SatisIrsaliyesi, as: 'satisIrsaliyesi' },
        { model: MusteriHesabi, as: 'musteri' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ]
    });
  }

  async getNextInvoiceNo() {
    const last = await SatisFaturasi.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'FAT-2026-0001';
    const num = last.id + 1;
    return `FAT-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      faturaNo: data.faturaNo || data.invoiceNo,
      satisSiparisId: data.satisSiparisId || data.saleOrderId,
      irsaliyeId: data.irsaliyeId || data.dispatchNoteId,
      musteriId: data.musteriId || data.customerId,
      musteriAdi: data.musteriAdi || data.customerName,
      musteriVergiDairesi: data.musteriVergiDairesi || data.customerTaxOffice,
      faturaAdresi: data.faturaAdresi || data.billingAddress,
      teslimatAdresi: data.teslimatAdresi || data.shippingAddress,
      musteriTelefon: data.musteriTelefon || data.customerPhone,
      musteriEposta: data.musteriEposta || data.customerEmail,
      faturaTarihi: data.faturaTarihi || data.invoiceDate,
      faturaSaati: data.faturaSaati || data.invoiceTime || '10:30:00',
      vadeTarihi: data.vadeTarihi || data.dueDate,
      faturaTuru: data.faturaTuru || data.invoiceType || 'SATIS',
      faturaSenaryosu: data.faturaSenaryosu || data.invoiceScenario || 'EARSIVFATURA',
      ettnNo: data.ettnNo || data.ettnNo,
      siparisNo: data.siparisNo || data.orderNo,
      siparisTarihi: data.siparisTarihi || data.orderDate,
      irsaliyeNo: data.irsaliyeNo || data.dispatchNo,
      irsaliyeTarihi: data.irsaliyeTarihi || data.dispatchDate,
      araToplam: data.araToplam !== undefined ? data.araToplam : data.subtotal,
      iskontoTutari: data.iskontoTutari !== undefined ? data.iskontoTutari : data.discountAmount,
      kdvTutari: data.kdvTutari !== undefined ? data.kdvTutari : data.taxAmount,
      toplamTutar: data.toplamTutar !== undefined ? data.toplamTutar : data.totalAmount,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      dovizKuru: data.dovizKuru !== undefined ? data.dovizKuru : data.exchangeRate,
      odemeTuru: data.odemeTuru || data.paymentType || 'Vadeli',
      vadeGunu: data.vadeGunu !== undefined ? data.vadeGunu : data.paymentTermDays,
      bankaAdi: data.bankaAdi || data.bankName,
      ibanNo: data.ibanNo || data.ibanNo,
      odemeDurumu: data.odemeDurumu || data.paymentStatus || 'Unpaid',
      durum: data.durum || data.status || 'Issued',
      kalemlerJson: data.kalemlerJson || data.itemsJson,
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    const invoice = await SatisFaturasi.create(cleanData);

    if (cleanData.musteriId) {
      await customerRepository.updateBalance(cleanData.musteriId, cleanData.toplamTutar);
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatisFaturasi',
      varlikId: invoice.id,
      detaylar: { faturaNo: invoice.faturaNo, toplamTutar: invoice.toplamTutar },
      ipAdresi: ipAddress
    });

    return invoice;
  }
}

module.exports = new InvoiceRepository();
