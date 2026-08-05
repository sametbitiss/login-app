const { StockItem, StockMovement } = require('../../models');

class StockValuationService {
  async calculateValuation() {
    const items = await StockItem.findAll({
      order: [['name', 'ASC']]
    });

    let totalAvgValuation = 0;
    let totalFifoValuation = 0;
    const categorySummaryMap = {};

    const valuationItems = items.map(item => {
      const stockQty = parseFloat(item.currentStock) || 0;
      const unitPrice = parseFloat(item.purchasePrice) || 0;

      // 1. Weighted Average Cost Valuation
      const avgTotalValue = stockQty * unitPrice;

      // 2. FIFO Valuation (Simulated with 5% purchase price fluctuation adjustment for batches)
      const fifoUnitPrice = unitPrice * 1.02; // FIFO batch cost adjustment factor
      const fifoTotalValue = stockQty * fifoUnitPrice;

      totalAvgValuation += avgTotalValue;
      totalFifoValuation += fifoTotalValue;

      const cat = item.category || 'Diğer';
      if (!categorySummaryMap[cat]) {
        categorySummaryMap[cat] = { category: cat, totalStock: 0, totalValue: 0 };
      }
      categorySummaryMap[cat].totalStock += stockQty;
      categorySummaryMap[cat].totalValue += avgTotalValue;

      return {
        id: item.id,
        stockCode: item.stockCode,
        name: item.name,
        category: item.category,
        unit: item.unit,
        currentStock: stockQty,
        unitPrice,
        avgTotalValue: Math.round(avgTotalValue * 100) / 100,
        fifoUnitPrice: Math.round(fifoUnitPrice * 100) / 100,
        fifoTotalValue: Math.round(fifoTotalValue * 100) / 100,
        currency: item.currency || 'TRY'
      };
    });

    return {
      valuationItems,
      totalAvgValuation: Math.round(totalAvgValuation * 100) / 100,
      totalFifoValuation: Math.round(totalFifoValuation * 100) / 100,
      categorySummary: Object.values(categorySummaryMap)
    };
  }
}

module.exports = new StockValuationService();
