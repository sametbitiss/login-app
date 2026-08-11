const { StockItem, PurchaseRequisition, Supplier } = require('../models');
const purchaseService = require('../src/services/purchaseService');
const { Op } = require('sequelize');

async function debugRfqAdd() {
  try {
    console.log('=== DEBUGGING RENDER ADD RFQ ===');

    const nextRfqNo = await purchaseService.getNextRfqNo();
    console.log('nextRfqNo:', nextRfqNo);

    const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });
    console.log('suppliers count:', suppliers.length);

    const requisitions = await PurchaseRequisition.findAll({
      where: { status: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
      include: [{ model: StockItem, as: 'stockItem' }],
      order: [['createdAt', 'DESC']]
    });
    console.log('requisitions count:', requisitions.length);

    const reqMap = new Map();
    requisitions.forEach(reqItem => {
      if (reqItem.stockItem && !reqMap.has(reqItem.stockItem.id)) {
        const minStockVal = parseFloat(reqItem.stockItem.minStock) || 10;
        reqMap.set(reqItem.stockItem.id, {
          stockItemId: reqItem.stockItem.id,
          stockCode: reqItem.stockItem.stockCode,
          name: reqItem.stockItem.name,
          category: reqItem.stockItem.category,
          unit: reqItem.stockItem.unit || 'Adet',
          minStock: minStockVal > 0 ? minStockVal : 10,
          purchasePrice: parseFloat(reqItem.stockItem.purchasePrice) || 0,
          requisitionNo: reqItem.requisitionNo,
          requisitionId: reqItem.id,
          requestedQuantity: parseFloat(reqItem.requestedQuantity) || minStockVal || 10
        });
      }
    });

    const requisitionedProducts = Array.from(reqMap.values());
    console.log('requisitionedProducts count:', requisitionedProducts.length);

    console.log('✅ ALL RENDER DATA FETCHED CLEANLY!');
  } catch (err) {
    console.error('❌ DEBUG ERROR Traceback:', err);
  }
}

debugRfqAdd();
