const { ProductionOrder, BOMItem, StockItem, RoutingOperation } = require('../../models');
const { Op } = require('sequelize');

class MRPService {
  async calculateMRP() {
    // 1. Fetch active production orders (Planned, Approved, In_Production)
    const activeOrders = await ProductionOrder.findAll({
      where: {
        status: { [Op.in]: ['Planned', 'Approved', 'In_Production'] }
      },
      include: [{ model: StockItem, as: 'stockItem' }]
    });

    const mrpMap = {};

    for (const order of activeOrders) {
      const boms = await BOMItem.findAll({
        where: { finishedStockItemId: order.stockItemId },
        include: [{ model: StockItem, as: 'componentItem' }]
      });

      const plannedQty = parseFloat(order.plannedQuantity) || 1;

      for (const bom of boms) {
        const comp = bom.componentItem;
        if (!comp) continue;

        const reqPerUnit = parseFloat(bom.quantityRequired) || 1;
        const scrapPct = parseFloat(bom.scrapPercentage) || 0;
        const reqQty = plannedQty * reqPerUnit * (1 + scrapPct / 100);

        if (!mrpMap[comp.id]) {
          mrpMap[comp.id] = {
            componentId: comp.id,
            stockCode: comp.stockCode,
            name: comp.name,
            unit: comp.unit,
            currentStock: parseFloat(comp.currentStock) || 0,
            grossRequirement: 0,
            unitPrice: parseFloat(comp.purchasePrice) || 0,
            currency: comp.currency || 'TRY',
            supplier: comp.supplier || 'Genel Tedarikçi',
            ordersAffected: []
          };
        }

        mrpMap[comp.id].grossRequirement += reqQty;
        mrpMap[comp.id].ordersAffected.push({
          workOrderNo: order.workOrderNo,
          productionTitle: order.productionTitle,
          plannedQty,
          requiredQty: reqQty
        });
      }
    }

    // Calculate Net Requirements and Shortages
    const mrpResults = Object.values(mrpMap).map(item => {
      const netRequirement = Math.max(0, item.grossRequirement - item.currentStock);
      const shortage = item.currentStock < item.grossRequirement;
      const estimatedCost = netRequirement * item.unitPrice;

      return {
        ...item,
        grossRequirement: Math.round(item.grossRequirement * 100) / 100,
        netRequirement: Math.round(netRequirement * 100) / 100,
        shortage,
        estimatedCost: Math.round(estimatedCost * 100) / 100
      };
    });

    const totalShortageItems = mrpResults.filter(i => i.shortage).length;
    const totalRequisitionCost = mrpResults.reduce((acc, i) => acc + i.estimatedCost, 0);

    return {
      mrpResults,
      activeOrdersCount: activeOrders.length,
      totalShortageItems,
      totalRequisitionCost
    };
  }

  async calculateCapacityLoad() {
    const workCenters = [
      'İstasyon-1 (Kesim & Büküm)',
      'İstasyon-2 (Kaynak & Sac İşleme)',
      'İstasyon-3 (CNC & Talaşlı İmalat)',
      'İstasyon-4 (Boya & Kaplama)',
      'İstasyon-5 (Montaj & Test)',
      'İstasyon-6 (Paketleme & Sevkiyat)'
    ];

    const weeklyCapacityHoursPerStation = 80.0; // 2 Vardiya x 40 Saat
    const capacityReport = [];

    for (const wc of workCenters) {
      const activeOrders = await ProductionOrder.findAll({
        where: {
          workCenter: wc,
          status: { [Op.in]: ['Planned', 'Approved', 'In_Production'] }
        }
      });

      const totalPlannedHours = activeOrders.reduce((sum, ord) => sum + (parseFloat(ord.estimatedHours) || 0), 0);
      const loadPercentage = Math.round((totalPlannedHours / weeklyCapacityHoursPerStation) * 100);
      const isBottleneck = loadPercentage > 85;

      capacityReport.push({
        workCenter: wc,
        activeOrdersCount: activeOrders.length,
        totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
        availableCapacityHours: weeklyCapacityHoursPerStation,
        loadPercentage,
        isBottleneck,
        statusLabel: isBottleneck ? 'Darboğaz (Aşırı Yük)' : loadPercentage > 50 ? 'Optimal Yük' : 'Düşük Yük'
      });
    }

    return capacityReport;
  }
}

module.exports = new MRPService();
