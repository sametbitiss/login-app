const { SatisIrsaliyesi, SatisSiparisi, MusteriHesabi, StokKarti, Kullanici, StokHareketi } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class DispatchRepository {
  async findAll({ search } = {}) {
    const where = {};
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { irsaliyeNo: { [Op.iLike]: s } },
        { musteriAdi: { [Op.iLike]: s } },
        { aracPlakasi: { [Op.iLike]: s } },
        { takipNo: { [Op.iLike]: s } }
      ];
    }

    return await SatisIrsaliyesi.findAll({
      where,
      include: [
        { model: SatisSiparisi, as: 'satisSiparisi', include: [{ model: StokKarti, as: 'stokKarti' }] },
        { model: MusteriHesabi, as: 'musteri' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SatisIrsaliyesi.findByPk(id, {
      include: [
        { model: SatisSiparisi, as: 'satisSiparisi', include: [{ model: StokKarti, as: 'stokKarti' }] },
        { model: MusteriHesabi, as: 'musteri' },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ]
    });
  }

  async getNextDispatchNo() {
    const last = await SatisIrsaliyesi.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'IRS-2026-0001';
    const num = last.id + 1;
    return `IRS-2026-${num.toString().padStart(4, '0')}`;
  }

  async getNextTrackingNo() {
    const last = await SatisIrsaliyesi.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'LOJ-2026-0001';
    const num = last.id + 1;
    return `LOJ-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      irsaliyeNo: data.irsaliyeNo || data.dispatchNo,
      irsaliyeTuru: data.irsaliyeTuru || data.dispatchType || 'Satış İrsaliyesi',
      satisSiparisId: data.satisSiparisId || data.saleOrderId,
      musteriId: data.musteriId || data.customerId,
      musteriAdi: data.musteriAdi || data.customerName,
      irsaliyeTarihi: data.irsaliyeTarihi || data.dispatchDate,
      sevkiyatTarihi: data.sevkiyatTarihi || data.shipmentDate,
      cikisDeposu: data.cikisDeposu || data.exitWarehouse || 'Merkez Lojistik Deposu',
      tasiyiciFirma: data.tasiyiciFirma || data.carrierCompany,
      aracPlakasi: data.aracPlakasi || data.vehiclePlate,
      surucuAdi: data.surucuAdi || data.driverName,
      takipNo: data.takipNo || data.trackingNo,
      teslimatAdresi: data.teslimatAdresi || data.shippingAddress,
      teslimatSehri: data.teslimatSehri || data.deliveryCity,
      teslimatIlcesi: data.teslimatIlcesi || data.deliveryDistrict,
      aliciKisi: data.aliciKisi || data.recipientPerson,
      teslimatTuru: data.teslimatTuru || data.deliveryType,
      projeNo: data.projeNo || data.projectNo,
      durum: data.durum || data.status || 'Dispatched',
      notlar: data.notlar || data.notes,
      kalemlerJson: data.kalemlerJson || data.itemsJson,
      olusturanId: currentUser ? currentUser.id : null
    };

    const dispatch = await SatisIrsaliyesi.create(cleanData);

    const saleOrder = await SatisSiparisi.findByPk(cleanData.satisSiparisId);
    if (saleOrder) {
      let totalOrderedQty = 0;
      if (saleOrder.kalemlerJson) {
        try {
          const orderItems = JSON.parse(saleOrder.kalemlerJson);
          if (Array.isArray(orderItems) && orderItems.length > 0) {
            totalOrderedQty = orderItems.reduce((sum, it) => sum + (parseFloat(it.miktar || it.quantity) || 0), 0);
          }
        } catch (e) {}
      }
      if (totalOrderedQty <= 0) {
        totalOrderedQty = parseFloat(saleOrder.miktar) || 0;
      }

      const allDispatches = await SatisIrsaliyesi.findAll({
        where: { satisSiparisId: saleOrder.id }
      });

      let totalDispatchedQtySoFar = 0;
      for (const d of allDispatches) {
        if (d.kalemlerJson) {
          try {
            const dItems = JSON.parse(d.kalemlerJson);
            if (Array.isArray(dItems)) {
              dItems.forEach(it => {
                totalDispatchedQtySoFar += parseFloat(it.dispatchQuantity || it.quantity || it.miktar || 0);
              });
            }
          } catch (e) {}
        } else {
          totalDispatchedQtySoFar += parseFloat(saleOrder.miktar) || 0;
        }
      }

      if (totalDispatchedQtySoFar >= totalOrderedQty) {
        saleOrder.durum = 'Completed';
        saleOrder.karsilanmaDurumu = 'Closed';
      } else {
        saleOrder.durum = 'Shipped';
        saleOrder.karsilanmaDurumu = 'Partial';
      }
      await saleOrder.save();

      let itemsToDeduct = [];
      if (cleanData.kalemlerJson) {
        try {
          itemsToDeduct = typeof cleanData.kalemlerJson === 'string' ? JSON.parse(cleanData.kalemlerJson) : cleanData.kalemlerJson;
        } catch (e) {
          itemsToDeduct = [];
        }
      }

      if (!Array.isArray(itemsToDeduct) || itemsToDeduct.length === 0) {
        itemsToDeduct = [{
          stokId: saleOrder.stokId,
          dispatchQuantity: saleOrder.miktar,
          unitPrice: saleOrder.birimFiyat
        }];
      }

      for (const it of itemsToDeduct) {
        const sId = parseInt(it.stokId || it.stockItemId, 10);
        const qtyToDeduct = parseFloat(it.dispatchQuantity || it.quantity || it.miktar || 1);
        if (sId && sId > 0 && qtyToDeduct > 0) {
          const item = await StokKarti.findByPk(sId);
          if (item) {
            const newStock = parseFloat(item.mevcutStok) - qtyToDeduct;
            item.mevcutStok = newStock < 0 ? 0 : newStock;

            const newReserved = parseFloat(item.rezerveStok || 0) - qtyToDeduct;
            item.rezerveStok = newReserved < 0 ? 0 : newReserved;

            await item.save();

            await StokHareketi.create({
              hareketNo: `SH-${Date.now().toString().slice(-6)}-${sId}`,
              stokId: item.id,
              cikisDepoId: 1,
              hareketTuru: 'Outbound',
              miktar: qtyToDeduct,
              birimFiyat: it.birimFiyat || it.unitPrice || item.satisFiyati || 0,
              referansNo: dispatch.irsaliyeNo,
              notlar: `[İrsaliyeli Sevkiyat] ${dispatch.irsaliyeNo} sevk irsaliyesi ile ${item.ad} (${qtyToDeduct} Adet) depodan çıkış yapıldı.`,
              yapanKullaniciId: currentUser ? currentUser.id : null
            });
          }
        }
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'SatisIrsaliyesi',
      varlikId: dispatch.id,
      detaylar: { irsaliyeNo: dispatch.irsaliyeNo, satisSiparisId: dispatch.satisSiparisId, musteriAdi: dispatch.musteriAdi },
      ipAdresi: ipAddress
    });

    return dispatch;
  }
}

module.exports = new DispatchRepository();
