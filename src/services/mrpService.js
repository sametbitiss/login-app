const {
  UretimEmri,
  UrunRecetesi,
  StokKarti,
  SatinAlmaTalebi,
  SatisSiparisi,
  sequelize
} = require('../../models');
const { Op } = require('sequelize');

class MRPService {
  async runMRP() {
    const activeOrders = await UretimEmri.findAll({
      where: { durum: { [Op.in]: ['Planned', 'Approved', 'In_Production'] } },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });

    const activeSales = await SatisSiparisi.findAll({
      where: { durum: 'Approved', karsilanmaDurumu: { [Op.ne]: 'Delivered' } },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });

    const requirementsMap = {};

    const addRequirement = async (finishedItemId, qty, refText) => {
      const bomItems = await UrunRecetesi.findAll({
        where: { mamulStokId: finishedItemId },
        include: [{ model: StokKarti, as: 'bilesenUrun' }]
      });

      if (bomItems && bomItems.length > 0) {
        for (const item of bomItems) {
          const compId = item.bilesenStokId;
          const scrapMultiplier = 1 + (parseFloat(item.fireOrani || 0) / 100);
          const itemReq = parseFloat(item.gerekliMiktar) * qty * scrapMultiplier;

          if (!requirementsMap[compId]) {
            requirementsMap[compId] = {
              componentItem: item.bilesenUrun,
              grossRequirement: 0,
              references: []
            };
          }

          requirementsMap[compId].grossRequirement += itemReq;
          requirementsMap[compId].references.push(`${refText} (${qty} Adet)`);
        }
      }
    };

    for (const order of activeOrders) {
      const remainingQty = parseFloat(order.planlananMiktar) - parseFloat(order.tamamlananMiktar);
      if (remainingQty > 0) {
        await addRequirement(order.stokId, remainingQty, `İş Emri: ${order.isEmriNo}`);
      }
    }

    for (const sale of activeSales) {
      await addRequirement(sale.stokId, parseFloat(sale.miktar), `Satış Siparişi: ${sale.siparisNo}`);
    }

    const mrpResults = [];

    for (const compId of Object.keys(requirementsMap)) {
      const data = requirementsMap[compId];
      const stockItem = data.componentItem;

      if (!stockItem) continue;

      const currentStock = parseFloat(stockItem.mevcutStok || 0);

      const openReqs = await SatinAlmaTalebi.findAll({
        where: {
          stokId: compId,
          durum: { [Op.in]: ['Pending_Approval', 'Approved', 'Pending'] }
        }
      });

      const openReqQty = openReqs.reduce((sum, r) => sum + parseFloat(r.talepEdilenMiktar || 0), 0);
      const totalAvailable = currentStock + openReqQty;
      const grossReq = data.grossRequirement;
      const netRequirement = Math.max(0, grossReq - totalAvailable);

      let urgency = 'Normal';
      if (currentStock <= 0 && netRequirement > 0) {
        urgency = 'Critical';
      } else if (netRequirement > (currentStock * 0.5)) {
        urgency = 'High';
      }

      mrpResults.push({
        stockItemId: compId,
        stokKodu: stockItem.stokKodu,
        ad: stockItem.ad,
        kategori: stockItem.kategori,
        birim: stockItem.birim,
        currentStock,
        openReqQty,
        grossRequirement: parseFloat(grossReq.toFixed(2)),
        totalAvailable: parseFloat(totalAvailable.toFixed(2)),
        netRequirement: parseFloat(netRequirement.toFixed(2)),
        urgency,
        references: data.references.join(', '),
        suggestedSupplier: stockItem.tedarikci || 'Ana Tedarikçi'
      });
    }

    return mrpResults;
  }

  async generateRequisitions(mrpResults, currentUser = null) {
    const createdReqs = [];
    for (const item of mrpResults) {
      if (item.netRequirement > 0) {
        const nextReqNo = `TAL-${Date.now().toString().slice(-6)}`;
        const req = await SatinAlmaTalebi.create({
          talepNo: nextReqNo,
          kaynakModul: 'Production',
          talepEdenAdi: currentUser ? (currentUser.ad ? `${currentUser.ad} ${currentUser.soyad}` : currentUser.kullaniciAdi) : 'MRP Engine',
          stokId: item.stockItemId,
          talepEdilenMiktar: item.netRequirement,
          birim: item.birim,
          aciliyet: item.urgency === 'Critical' ? 'Urgent' : 'High',
          durum: 'Approved',
          notlar: `Otomatik MRP Çalıştırması: Net İhtiyaç (${item.netRequirement} ${item.birim})`,
          olusturanId: currentUser ? currentUser.id : null
        });
        createdReqs.push(req);
      }
    }
    return createdReqs;
  }

  async calculateCapacityLoad() {
    const WORK_CENTERS = [
      { name: 'İstasyon-1 (Kesim & Büküm)', dailyCapacityHours: 16 },
      { name: 'İstasyon-2 (Kaynak & Sac İşleme)', dailyCapacityHours: 16 },
      { name: 'İstasyon-3 (CNC & Talaşlı İmalat)', dailyCapacityHours: 24 },
      { name: 'İstasyon-4 (Boya & Kaplama)', dailyCapacityHours: 16 },
      { name: 'İstasyon-5 (Montaj & Test)', dailyCapacityHours: 16 },
      { name: 'İstasyon-6 (Paketleme & Sevkiyat)', dailyCapacityHours: 16 }
    ];

    const activeOrders = await UretimEmri.findAll({
      where: { durum: { [Op.in]: ['Planned', 'Approved', 'In_Production'] } }
    });

    const report = WORK_CENTERS.map(wc => {
      const stationOrders = activeOrders.filter(o => o.isMerkezi === wc.name);
      const allocatedHours = stationOrders.reduce((sum, o) => {
        const remainingQty = Math.max(0, parseFloat(o.planlananMiktar) - parseFloat(o.tamamlananMiktar));
        const estHours = parseFloat(o.tahminiSaat || 0);
        return sum + (remainingQty * (estHours / (parseFloat(o.planlananMiktar) || 1)));
      }, 0);

      const loadPercentage = Math.min(100, Math.round((allocatedHours / (wc.dailyCapacityHours * 5)) * 100));
      const isBottleneck = loadPercentage > 85;

      return {
        workCenterName: wc.name,
        dailyCapacityHours: wc.dailyCapacityHours,
        horizonCapacityHours: wc.dailyCapacityHours * 5,
        allocatedHours: parseFloat(allocatedHours.toFixed(1)),
        availableHours: Math.max(0, parseFloat(((wc.dailyCapacityHours * 5) - allocatedHours).toFixed(1))),
        loadPercentage,
        activeOrdersCount: stationOrders.length,
        isBottleneck
      };
    });

    return report;
  }
}

module.exports = new MRPService();
