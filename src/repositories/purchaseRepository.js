const { SatinAlmaSiparisi, Kullanici, StokKarti, StokHareketi, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class PurchaseRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.durum = filters.status;
    }

    if (filters.paymentTerm) {
      where.odemeVadesi = filters.paymentTerm;
    }

    if (filters.search) {
      where[Op.or] = [
        { siparisNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { tedarikciAdi: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { tedarikciVergiNo: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await SatinAlmaSiparisi.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim', 'mevcutStok'] }
      ]
    });
  }

  async findById(id) {
    return await SatinAlmaSiparisi.findByPk(id, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti' }
      ]
    });
  }

  async findByOrderNo(siparisNo) {
    return await SatinAlmaSiparisi.findOne({ where: { siparisNo } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      siparisNo: data.siparisNo || data.orderNo,
      tedarikciAdi: data.tedarikciAdi || data.supplierName,
      tedarikciVergiNo: data.tedarikciVergiNo || data.supplierTaxNo,
      tedarikciIlgiliKisi: data.tedarikciIlgiliKisi || data.supplierContactPerson,
      tedarikciEposta: data.tedarikciEposta || data.supplierEmail,
      tedarikciTelefon: data.tedarikciTelefon || data.supplierPhone,
      siparisTarihi: data.siparisTarihi || data.orderDate || new Date().toISOString().split('T')[0],
      beklenenTeslimTarihi: data.beklenenTeslimTarihi || data.expectedDeliveryDate,
      odemeVadesi: data.odemeVadesi || data.paymentTerm || 'Pesin',
      durum: data.durum || data.status || 'Pending_Approval',
      oncelik: data.oncelik || data.priority || 'Normal',
      stokId: data.stokId || data.stockItemId,
      miktar: data.miktar !== undefined ? data.miktar : data.quantity,
      birimFiyat: data.birimFiyat !== undefined ? data.birimFiyat : data.unitPrice,
      iskontoOrani: data.iskontoOrani !== undefined ? data.iskontoOrani : data.discountRate,
      kdvOrani: data.kdvOrani !== undefined ? data.kdvOrani : data.taxRate,
      araToplam: data.araToplam !== undefined ? data.araToplam : data.subtotal,
      iskontoTutari: data.iskontoTutari !== undefined ? data.iskontoTutari : data.discountAmount,
      kdvTutari: data.kdvTutari !== undefined ? data.kdvTutari : data.taxAmount,
      toplamTutar: data.toplamTutar !== undefined ? data.toplamTutar : data.totalAmount,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      teslimDeposu: data.teslimDeposu || data.deliveryWarehouse,
      satinAlmaci: data.satinAlmaci || data.purchasingAgent,
      tedarikciId: data.tedarikciId || data.supplierId,
      notlar: data.notlar || data.notes,
      kalemlerJson: data.kalemlerJson || data.itemsJson,
      olusturanId: currentUser ? currentUser.id : null
    };

    const order = await SatinAlmaSiparisi.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatinAlmaSiparisi',
      varlikId: order.id,
      detaylar: { siparisNo: order.siparisNo, tedarikciAdi: order.tedarikciAdi, toplamTutar: order.toplamTutar, paraBirimi: order.paraBirimi },
      ipAdresi: ipAddress
    });

    return order;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const order = await SatinAlmaSiparisi.findByPk(id);
    if (!order) return null;

    const oldData = { durum: order.durum, toplamTutar: order.toplamTutar };
    await order.update(data);

    const newStatus = data.durum || data.status;
    if (newStatus === 'Received' && oldData.durum !== 'Received') {
      const item = await StokKarti.findByPk(order.stokId);
      if (item) {
        item.mevcutStok = parseFloat(item.mevcutStok) + parseFloat(order.miktar);
        await item.save();

        const moveNo = `SH-${Date.now().toString().slice(-6)}`;
        await StokHareketi.create({
          hareketNo: moveNo,
          stokId: item.id,
          varisDepoId: 1,
          hareketTuru: 'Inbound',
          miktar: order.miktar,
          birimFiyat: order.birimFiyat,
          referansNo: order.siparisNo,
          notlar: `[Mal Kabul] ${order.siparisNo} satın alma siparişi depoya alındı ve stok güncellendi.`,
          yapanKullaniciId: currentUser ? currentUser.id : null
        });
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'SatinAlmaSiparisi',
      varlikId: order.id,
      detaylar: { oldData, newData: data },
      ipAdresi: ipAddress
    });

    return order;
  }

  async updateStatus(id, durum, currentUser = null, ipAddress = null) {
    return await this.update(id, { durum }, currentUser, ipAddress);
  }

  async delete(id, currentUser = null, ipAddress = null) {
    const order = await SatinAlmaSiparisi.findByPk(id);
    if (!order) return false;

    const deletedCode = order.siparisNo;
    await order.destroy();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'SatinAlmaSiparisi',
      varlikId: id,
      detaylar: { siparisNo: deletedCode },
      ipAdresi: ipAddress
    });

    return true;
  }

  async getNextOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `SATIN-${year}-`;
    const lastOrder = await SatinAlmaSiparisi.findOne({
      where: { siparisNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return `${prefix}0001`;

    const parts = lastOrder.siparisNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalOrders = await SatinAlmaSiparisi.count();
    const pendingOrders = await SatinAlmaSiparisi.count({ where: { durum: 'Pending_Approval' } });
    const receivedOrders = await SatinAlmaSiparisi.count({ where: { durum: 'Received' } });

    const totalSpendResult = await SatinAlmaSiparisi.sum('toplamTutar', { where: { durum: { [Op.ne]: 'Cancelled' } } });
    const totalSpend = totalSpendResult || 0;

    return { totalOrders, pendingOrders, receivedOrders, totalSpend };
  }
}

module.exports = new PurchaseRepository();
