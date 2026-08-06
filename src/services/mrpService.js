const {
  ProductionOrder,
  BOMItem,
  StockItem,
  PurchaseRequisition,
  SaleOrder,
  sequelize
} = require('../../models');
const { Op } = require('sequelize');

class MRPService {
  /**
   * Run Material Requirements Planning (MRP) calculation
   * Calculates gross requirement, current stock, open requisitions, and net requirement.
   */
  async runMRP() {
    // 1. Fetch active production orders (Planned, Approved, In_Production)
    const activeOrders = await ProductionOrder.findAll({
      where: { status: { [Op.in]: ['Planned', 'Approved', 'In_Production'] } },
      include: [{ model: StockItem, as: 'stockItem' }]
    });

    // 2. Fetch approved sales orders that are pending fulfillment
    const activeSales = await SaleOrder.findAll({
      where: { status: 'Approved', fulfillmentStatus: { [Op.ne]: 'Delivered' } },
      include: [{ model: StockItem, as: 'stockItem' }]
    });

    // Map to accumulate gross requirements per component stock item ID
    const requirementsMap = {};

    // Helper to add to requirements map
    const addRequirement = async (finishedItemId, qty, refText) => {
      const bomItems = await BOMItem.findAll({
        where: { finishedStockItemId: finishedItemId },
        include: [{ model: StockItem, as: 'componentItem' }]
      });

      if (bomItems && bomItems.length > 0) {
        for (const item of bomItems) {
          const compId = item.componentStockItemId;
          const scrapMultiplier = 1 + (parseFloat(item.scrapPercentage || 0) / 100);
          const itemReq = parseFloat(item.quantityRequired) * qty * scrapMultiplier;

          if (!requirementsMap[compId]) {
            requirementsMap[compId] = {
              componentItem: item.componentItem,
              grossRequirement: 0,
              references: []
            };
          }

          requirementsMap[compId].grossRequirement += itemReq;
          requirementsMap[compId].references.push(`${refText} (${qty} Adet)`);
        }
      }
    };

    // Calculate requirements from Production Orders
    for (const order of activeOrders) {
      const remainingQty = parseFloat(order.plannedQuantity) - parseFloat(order.completedQuantity);
      if (remainingQty > 0) {
        await addRequirement(order.stockItemId, remainingQty, `İş Emri: ${order.workOrderNo}`);
      }
    }

    // Calculate requirements from Sales Orders
    for (const sale of activeSales) {
      await addRequirement(sale.stockItemId, parseFloat(sale.quantity), `Satış Siparişi: ${sale.orderNo}`);
    }

    // 3. Compare with Current Stock & Open Purchase Requisitions
    const mrpResults = [];

    for (const compId of Object.keys(requirementsMap)) {
      const data = requirementsMap[compId];
      const stockItem = data.componentItem;

      if (!stockItem) continue;

      const currentStock = parseFloat(stockItem.currentStock || 0);

      // Check open purchase requisitions for this component
      const openReqs = await PurchaseRequisition.findAll({
        where: {
          stockItemId: compId,
          status: { [Op.in]: ['Pending_Approval', 'Approved'] }
        }
      });

      const openReqQty = openReqs.reduce((sum, r) => sum + parseFloat(r.quantity || 0), 0);
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
        stockCode: stockItem.stockCode,
        name: stockItem.name,
        category: stockItem.category,
        unit: stockItem.unit,
        currentStock,
        openReqQty,
        grossRequirement: parseFloat(grossReq.toFixed(2)),
        totalAvailable: parseFloat(totalAvailable.toFixed(2)),
        netRequirement: parseFloat(netRequirement.toFixed(2)),
        urgency,
        references: data.references.join(', '),
        suggestedSupplier: stockItem.supplier || 'Ana Tedarikçi'
      });
    }

    return mrpResults;
  }

  /**
   * Auto-generate Purchase Requisitions for items with Net Requirement > 0
   */
  async generateRequisitions(mrpResults, currentUser = null) {
    const createdReqs = [];
    for (const item of mrpResults) {
      if (item.netRequirement > 0) {
        const nextReqNo = `TAL-${Date.now().toString().slice(-6)}`;
        const req = await PurchaseRequisition.create({
          requisitionNo: nextReqNo,
          department: 'Üretim Planlama & İmalat',
          requestedBy: currentUser ? (currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username) : 'MRP Engine',
          stockItemId: item.stockItemId,
          quantity: item.netRequirement,
          unit: item.unit,
          urgency: item.urgency === 'Critical' ? 'Urgent' : 'High',
          status: 'Approved', // Auto-approved by MRP Engine
          justification: `Otomatik MRP Çalıştırması: Net İhtiyaç (${item.netRequirement} ${item.unit})`,
          estimatedCost: parseFloat((item.netRequirement * 50).toFixed(2)),
          createdBy: currentUser ? currentUser.id : null
        });
        createdReqs.push(req);
      }
    }
    return createdReqs;
  }

  /**
   * Calculate Capacity Load for Work Stations
   */
  async calculateCapacityLoad() {
    const WORK_CENTERS = [
      { name: 'İstasyon-1 (Kesim & Büküm)', dailyCapacityHours: 16 },
      { name: 'İstasyon-2 (Kaynak & Sac İşleme)', dailyCapacityHours: 16 },
      { name: 'İstasyon-3 (CNC & Talaşlı İmalat)', dailyCapacityHours: 24 },
      { name: 'İstasyon-4 (Boya & Kaplama)', dailyCapacityHours: 16 },
      { name: 'İstasyon-5 (Montaj & Test)', dailyCapacityHours: 16 },
      { name: 'İstasyon-6 (Paketleme & Sevkiyat)', dailyCapacityHours: 16 }
    ];

    const activeOrders = await ProductionOrder.findAll({
      where: { status: { [Op.in]: ['Planned', 'Approved', 'In_Production'] } }
    });

    const report = WORK_CENTERS.map(wc => {
      const stationOrders = activeOrders.filter(o => o.workCenter === wc.name);
      const allocatedHours = stationOrders.reduce((sum, o) => {
        const remainingQty = Math.max(0, parseFloat(o.plannedQuantity) - parseFloat(o.completedQuantity));
        const estHours = parseFloat(o.estimatedHours || 0);
        return sum + (remainingQty * (estHours / (parseFloat(o.plannedQuantity) || 1)));
      }, 0);

      const loadPercentage = Math.min(100, Math.round((allocatedHours / (wc.dailyCapacityHours * 5)) * 100)); // 5-day horizon
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
