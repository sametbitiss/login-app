const { MalKabul, SatinAlmaSiparisi, Kullanici, StokKarti, Tedarikci, StokHareketi, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class GoodsReceiptRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.durum = filters.status;
    }
    if (filters.qualityStatus) {
      where.kaliteDurumu = filters.qualityStatus;
    }
    if (filters.search) {
      where[Op.or] = [
        { malKabulNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { irsaliyeNo: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await MalKabul.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: SatinAlmaSiparisi, as: 'satinAlmaSiparisi', attributes: ['id', 'siparisNo', 'tedarikciAdi', 'durum'] },
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim'] },
        { model: Tedarikci, as: 'tedarikci', attributes: ['id', 'tedarikciKodu', 'firmaAdi'] }
      ]
    });
  }

  async findById(id) {
    return await MalKabul.findByPk(id, {
      include: [
        { model: Kullanici, as: 'olusturan' },
        { model: SatinAlmaSiparisi, as: 'satinAlmaSiparisi' },
        { model: StokKarti, as: 'stokKarti' },
        { model: Tedarikci, as: 'tedarikci' }
      ]
    });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      malKabulNo: data.malKabulNo || data.grnNo,
      satinAlmaSiparisId: data.satinAlmaSiparisId || data.purchaseOrderId,
      tedarikciId: data.tedarikciId || data.supplierId,
      stokId: data.stokId || data.stockItemId,
      siparisMiktari: data.siparisMiktari !== undefined ? data.siparisMiktari : data.orderedQuantity,
      teslimMiktari: data.teslimMiktari !== undefined ? data.teslimMiktari : data.receivedQuantity,
      kabulMiktari: data.kabulMiktari !== undefined ? data.kabulMiktari : data.acceptedQuantity,
      redMiktari: data.redMiktari !== undefined ? data.redMiktari : data.rejectedQuantity,
      kabulTarihi: data.kabulTarihi || data.receiptDate || new Date().toISOString().split('T')[0],
      irsaliyeNo: data.irsaliyeNo || data.deliveryNoteNo,
      irsaliyeTarihi: data.irsaliyeTarihi || data.deliveryNoteDate,
      irsaliyeFotograf: data.irsaliyeFotograf || data.deliveryNotePhoto,
      kalemlerVerisi: data.kalemlerVerisi || data.itemsData,
      kaliteDurumu: data.kaliteDurumu || data.qualityStatus || 'Pending_Inspection',
      denetciAdi: data.denetciAdi || data.inspectorName,
      kaliteNotlari: data.kaliteNotlari || data.qualityNotes,
      depoLokasyonu: data.depoLokasyonu || data.warehouseLocation,
      durum: data.durum || data.status || 'Pending',
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    const grn = await MalKabul.create(cleanData);

    if (cleanData.satinAlmaSiparisId) {
      const po = await SatinAlmaSiparisi.findByPk(cleanData.satinAlmaSiparisId);
      if (po) {
        const orderedQty = parseFloat(po.miktar) || 0;
        
        const totalReceived = await MalKabul.sum('teslimMiktari', {
          where: { satinAlmaSiparisId: cleanData.satinAlmaSiparisId }
        }) || 0;

        if (totalReceived >= orderedQty) {
          await po.update({ durum: 'Received' });
        } else {
          await po.update({ durum: 'Partial_Received' });
        }
      }
    }

    if (cleanData.kaliteDurumu === 'Approved') {
      const acceptedQty = parseFloat(cleanData.kabulMiktari) || parseFloat(cleanData.teslimMiktari) || 0;
      if (acceptedQty > 0 && cleanData.stokId) {
        const item = await StokKarti.findByPk(cleanData.stokId);
        if (item) {
          item.mevcutStok = parseFloat(item.mevcutStok) + acceptedQty;
          await item.save();

          const moveNo = `GRN-${Date.now().toString().slice(-6)}`;
          await StokHareketi.create({
            hareketNo: moveNo,
            stokId: item.id,
            varisDepoId: 1,
            hareketTuru: 'Inbound',
            miktar: acceptedQty,
            birimFiyat: 0,
            referansNo: cleanData.malKabulNo,
            notlar: `[Mal Kabul] ${cleanData.malKabulNo} mal kabul fişi ile stok girişi yapıldı.`,
            yapanKullaniciId: currentUser ? currentUser.id : null
          });
        }
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'MalKabul',
      varlikId: grn.id,
      detaylar: { malKabulNo: grn.malKabulNo, satinAlmaSiparisId: grn.satinAlmaSiparisId, teslimMiktari: grn.teslimMiktari },
      ipAdresi: ipAddress
    });

    return grn;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const grn = await MalKabul.findByPk(id);
    if (!grn) return null;

    await grn.update(data);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'MalKabul',
      varlikId: grn.id,
      detaylar: data,
      ipAdresi: ipAddress
    });

    return grn;
  }

  async getReceiptsByOrderId(orderId) {
    return await MalKabul.findAll({
      where: { satinAlmaSiparisId: orderId },
      order: [['createdAt', 'DESC']],
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: Tedarikci, as: 'tedarikci', attributes: ['id', 'tedarikciKodu', 'firmaAdi'] }
      ]
    });
  }

  async getReceivedTotalsForOrder(orderId) {
    const receipts = await MalKabul.findAll({
      where: { satinAlmaSiparisId: orderId }
    });

    const receivedMap = {};
    receipts.forEach(gr => {
      let items = [];
      if (gr.kalemlerVerisi) {
        try {
          items = typeof gr.kalemlerVerisi === 'string' ? JSON.parse(gr.kalemlerVerisi) : gr.kalemlerVerisi;
        } catch (e) { items = []; }
      }

      if (Array.isArray(items) && items.length > 0) {
        items.forEach(it => {
          const sId = parseInt(it.stokId || it.stockItemId, 10);
          const qty = parseFloat(it.currentReceivedQuantity || it.receivedQuantity || it.teslimMiktari || 0);
          if (sId) {
            receivedMap[sId] = (receivedMap[sId] || 0) + qty;
          }
        });
      } else if (gr.stokId) {
        const sId = parseInt(gr.stokId, 10);
        const qty = parseFloat(gr.teslimMiktari || 0);
        if (sId) {
          receivedMap[sId] = (receivedMap[sId] || 0) + qty;
        }
      }
    });

    return receivedMap;
  }

  async getNextGrnNo() {
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;
    const receipts = await MalKabul.findAll({
      where: { malKabulNo: { [Op.like]: `${prefix}%` } },
      attributes: ['malKabulNo']
    });

    let maxSeq = 0;
    receipts.forEach(r => {
      const numStr = r.malKabulNo.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    while (await MalKabul.findOne({ where: { malKabulNo: candidate } })) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }
    return candidate;
  }

  async getStats() {
    const totalReceipts = await MalKabul.count();
    const pendingInspection = await MalKabul.count({ where: { kaliteDurumu: 'Pending_Inspection' } });
    const completedReceipts = await MalKabul.count({ where: { durum: 'Completed' } });
    return { totalReceipts, pendingInspection, completedReceipts };
  }
}

module.exports = new GoodsReceiptRepository();
