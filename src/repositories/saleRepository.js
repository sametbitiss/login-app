const { SatisSiparisi, Kullanici, StokKarti, StokHareketi, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class SaleRepository {
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
        { musteriAdi: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { musteriVergiNo: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await SatisSiparisi.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim', 'mevcutStok'] }
      ]
    });
  }

  async findById(id) {
    const validId = parseInt(id, 10);
    if (!validId || Number.isNaN(validId) || validId <= 0) return null;
    return await SatisSiparisi.findByPk(validId, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti' }
      ]
    });
  }

  async findByOrderNo(siparisNo) {
    if (!siparisNo) return null;
    return await SatisSiparisi.findOne({ where: { siparisNo } });
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

    let musteriId = safeInt(data.musteriId || data.customerId);
    let stokId = safeInt(data.stokId || data.stockItemId);

    if (!stokId || stokId <= 0) {
      const defaultStock = await StokKarti.findOne({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } } });
      stokId = defaultStock ? defaultStock.id : 1;
    }

    const miktar = safeFloat(data.miktar !== undefined ? data.miktar : data.quantity, 1);
    const birimFiyat = safeFloat(data.birimFiyat !== undefined ? data.birimFiyat : data.unitPrice, 0);
    const iskontoOrani = safeFloat(data.iskontoOrani !== undefined ? data.iskontoOrani : data.discountRate, 0);
    const kdvOrani = safeFloat(data.kdvOrani !== undefined ? data.kdvOrani : data.taxRate, 20);
    const araToplam = safeFloat(data.araToplam !== undefined ? data.araToplam : data.subtotal, 0);
    const iskontoTutari = safeFloat(data.iskontoTutari !== undefined ? data.iskontoTutari : data.discountAmount, 0);
    const kdvTutari = safeFloat(data.kdvTutari !== undefined ? data.kdvTutari : data.taxAmount, 0);
    const toplamTutar = safeFloat(data.toplamTutar !== undefined ? data.toplamTutar : data.totalAmount, 0);

    const cleanData = {
      siparisNo: data.siparisNo || data.orderNo,
      musteriId,
      musteriAdi: data.musteriAdi || data.customerName,
      musteriVergiNo: data.musteriVergiNo || data.customerTaxNo,
      musteriEposta: data.musteriEposta || data.customerEmail,
      musteriTelefon: data.musteriTelefon || data.customerPhone,
      siparisTarihi: data.siparisTarihi || data.orderDate || new Date().toISOString().split('T')[0],
      teslimTarihi: data.teslimTarihi || data.deliveryDate,
      odemeVadesi: data.odemeVadesi || data.paymentTerm || 'Pesin',
      durum: data.durum || data.status || 'Pending_Approval',
      karsilanmaDurumu: data.karsilanmaDurumu || data.fulfillmentStatus || 'Open',
      onayGerekli: data.onayGerekli !== undefined ? data.onayGerekli : (data.approvalNeeded || false),
      onayNedeni: data.onayNedeni || data.approvalReason,
      yoneticiNotlari: data.yoneticiNotlari || data.managerNotes,
      oncelik: data.oncelik || data.priority || 'Normal',
      stokId,
      kalemlerJson: data.kalemlerJson || data.itemsJson,
      miktar,
      birimFiyat,
      iskontoOrani,
      kdvOrani,
      araToplam,
      iskontoTutari,
      kdvTutari,
      toplamTutar,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      teslimatAdresi: data.teslimatAdresi || data.shippingAddress,
      faturaAdresi: data.faturaAdresi || data.billingAddress,
      satisTemsilcisi: data.satisTemsilcisi || data.salesRep,
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    const order = await SatisSiparisi.create(cleanData);

    let itemsToReserve = [];
    if (order.kalemlerJson) {
      try { itemsToReserve = JSON.parse(order.kalemlerJson); } catch (e) { itemsToReserve = []; }
    }
    if (!Array.isArray(itemsToReserve) || itemsToReserve.length === 0) {
      itemsToReserve = [{ stokId: order.stokId, miktar: order.miktar }];
    }
    for (const it of itemsToReserve) {
      const sId = parseInt(it.stokId || it.stockItemId, 10);
      const qty = parseFloat(it.miktar || it.quantity || 0);
      if (sId && sId > 0 && qty > 0) {
        const item = await StokKarti.findByPk(sId);
        if (item) {
          item.rezerveStok = parseFloat(item.rezerveStok || 0) + qty;
          await item.save();

          // Otomatik Üretim Talebi (Production Requisition) Oluşturma
          try {
            const { UretimEmri } = require('../../models');
            const year = new Date().getFullYear();
            const prefix = `URETIM-${year}-`;
            const lastOrder = await UretimEmri.findOne({
              where: { isEmriNo: { [Op.like]: `${prefix}%` } },
              order: [['id', 'DESC']]
            });
            let nextSeq = 1;
            if (lastOrder) {
              const lastNoStr = lastOrder.isEmriNo.replace(prefix, '');
              nextSeq = (parseInt(lastNoStr, 10) || 0) + 1;
            }
            const reqWorkOrderNo = `${prefix}${String(nextSeq).padStart(4, '0')}`;

            const todayStr = new Date().toISOString().split('T')[0];
            let deliveryDateStr = order.teslimTarihi ? new Date(order.teslimTarihi).toISOString().split('T')[0] : null;
            if (!deliveryDateStr) {
              const d = new Date();
              d.setDate(d.getDate() + 7);
              deliveryDateStr = d.toISOString().split('T')[0];
            }

            const isUrgent = order.oncelik === 'Urgent' || order.oncelik === 'High' || order.oncelik === 'Acil';

            await UretimEmri.create({
              isEmriNo: reqWorkOrderNo,
              uretimBasligi: `🏭 [Sipariş: ${order.siparisNo}] ${item.ad} Üretim Talebi`,
              stokId: item.id,
              planlananMiktar: qty,
              tamamlananMiktar: 0,
              fireMiktari: 0,
              birim: item.birim || 'Adet',
              durum: 'Planned',
              oncelik: isUrgent ? 'Urgent' : 'Normal',
              isMerkezi: 'İstasyon-1 (Kesim & Büküm)',
              planlananBaslangicTarihi: todayStr,
              planlananBitisTarihi: deliveryDateStr,
              tahminiSaat: Math.max(1, Math.round(qty * 1.5)),
              receteNotlari: `Müşteri: ${order.musteriAdi || '—'} | Satış Sipariş No: ${order.siparisNo}`,
              notlar: `[Satış Siparişi Otomasyonu] ${order.siparisNo} numaralı satış siparişi (${order.musteriAdi || 'Müşteri'}) için sistem tarafından otomatik oluşturulan üretim talebidir.`,
              olusturanId: currentUser ? currentUser.id : null
            });
          } catch (reqErr) {
            console.error('Error creating automatic production requisition from sales order:', reqErr);
          }
        }
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatisSiparisi',
      varlikId: order.id,
      detaylar: { siparisNo: order.siparisNo, musteriAdi: order.musteriAdi, toplamTutar: order.toplamTutar, paraBirimi: order.paraBirimi },
      ipAdresi: ipAddress
    });

    return order;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const order = await SatisSiparisi.findByPk(id);
    if (!order) return null;

    const oldData = { durum: order.durum, toplamTutar: order.toplamTutar };
    await order.update(data);

    const newStatus = data.durum || data.status;
    if ((newStatus === 'Cancelled' || newStatus === 'Rejected') && oldData.durum !== 'Cancelled' && oldData.durum !== 'Rejected' && oldData.durum !== 'Completed') {
      let itemsToRelease = [];
      if (order.kalemlerJson) {
        try { itemsToRelease = JSON.parse(order.kalemlerJson); } catch (e) { itemsToRelease = []; }
      }
      if (!Array.isArray(itemsToRelease) || itemsToRelease.length === 0) {
        itemsToRelease = [{ stokId: order.stokId, miktar: order.miktar }];
      }
      for (const it of itemsToRelease) {
        const sId = parseInt(it.stokId || it.stockItemId, 10);
        const qty = parseFloat(it.miktar || it.quantity || 0);
        if (sId && sId > 0 && qty > 0) {
          const item = await StokKarti.findByPk(sId);
          if (item) {
            const newReserved = parseFloat(item.rezerveStok || 0) - qty;
            item.rezerveStok = newReserved < 0 ? 0 : newReserved;
            await item.save();
          }
        }
      }
    }

    if (newStatus === 'Completed' && oldData.durum !== 'Completed') {
      const item = await StokKarti.findByPk(order.stokId);
      if (item) {
        const newStock = parseFloat(item.mevcutStok) - parseFloat(order.miktar);
        item.mevcutStok = newStock < 0 ? 0 : newStock;
        await item.save();

        const moveNo = `SH-${Date.now().toString().slice(-6)}`;
        await StokHareketi.create({
          hareketNo: moveNo,
          stokId: item.id,
          cikisDepoId: 1,
          hareketTuru: 'Outbound',
          miktar: order.miktar,
          birimFiyat: order.birimFiyat,
          referansNo: order.siparisNo,
          notlar: `[Depodan Sevk] ${order.siparisNo} satış siparişi sevk edildi ve stok düşüldü.`,
          yapanKullaniciId: currentUser ? currentUser.id : null
        });
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'SatisSiparisi',
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
    const order = await SatisSiparisi.findByPk(id);
    if (!order) return false;

    if (order.durum !== 'Cancelled' && order.durum !== 'Rejected' && order.durum !== 'Completed') {
      let itemsToRelease = [];
      if (order.kalemlerJson) {
        try { itemsToRelease = JSON.parse(order.kalemlerJson); } catch (e) { itemsToRelease = []; }
      }
      if (!Array.isArray(itemsToRelease) || itemsToRelease.length === 0) {
        itemsToRelease = [{ stokId: order.stokId, miktar: order.miktar }];
      }
      for (const it of itemsToRelease) {
        const sId = parseInt(it.stokId || it.stockItemId, 10);
        const qty = parseFloat(it.miktar || it.quantity || 0);
        if (sId && sId > 0 && qty > 0) {
          const item = await StokKarti.findByPk(sId);
          if (item) {
            const newReserved = parseFloat(item.rezerveStok || 0) - qty;
            item.rezerveStok = newReserved < 0 ? 0 : newReserved;
            await item.save();
          }
        }
      }
    }

    const deletedCode = order.siparisNo;
    await order.destroy();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'SatisSiparisi',
      varlikId: id,
      detaylar: { siparisNo: deletedCode },
      ipAdresi: ipAddress
    });

    return true;
  }

  async getNextOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `SAT-${year}-`;
    const lastOrder = await SatisSiparisi.findOne({
      where: { siparisNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return `${prefix}0001`;

    const parts = lastOrder.siparisNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalOrders = await SatisSiparisi.count();
    const pendingOrders = await SatisSiparisi.count({ where: { durum: 'Pending_Approval' } });
    const completedOrders = await SatisSiparisi.count({ where: { durum: 'Completed' } });

    const totalRevenueResult = await SatisSiparisi.sum('toplamTutar', { where: { durum: { [Op.ne]: 'Cancelled' } } });
    const totalRevenue = totalRevenueResult || 0;

    return { totalOrders, pendingOrders, completedOrders, totalRevenue };
  }
}

module.exports = new SaleRepository();
