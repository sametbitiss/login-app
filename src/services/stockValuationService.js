const { StokKarti, StokHareketi } = require('../../models');

class StockValuationService {
  async calculateValuation() {
    const items = await StokKarti.findAll({
      order: [['ad', 'ASC']]
    });

    let totalAvgValuation = 0;
    let totalFifoValuation = 0;
    const categorySummaryMap = {};

    const valuationItems = items.map(item => {
      const stockQty = parseFloat(item.mevcutStok) || 0;
      const unitPrice = parseFloat(item.alisFiyati) || 0;

      const avgTotalValue = stockQty * unitPrice;
      const fifoUnitPrice = unitPrice * 1.02;
      const fifoTotalValue = stockQty * fifoUnitPrice;

      totalAvgValuation += avgTotalValue;
      totalFifoValuation += fifoTotalValue;

      const cat = item.kategori || 'Diğer';
      if (!categorySummaryMap[cat]) {
        categorySummaryMap[cat] = { category: cat, totalStock: 0, totalValue: 0 };
      }
      categorySummaryMap[cat].totalStock += stockQty;
      categorySummaryMap[cat].totalValue += avgTotalValue;

      return {
        id: item.id,
        stokKodu: item.stokKodu,
        stockCode: item.stokKodu,
        ad: item.ad,
        name: item.ad,
        kategori: item.kategori,
        category: item.kategori,
        birim: item.birim,
        unit: item.birim,
        currentStock: stockQty,
        mevcutStok: stockQty,
        unitPrice,
        alisFiyati: unitPrice,
        avgTotalValue: Math.round(avgTotalValue * 100) / 100,
        fifoUnitPrice: Math.round(fifoUnitPrice * 100) / 100,
        fifoTotalValue: Math.round(fifoTotalValue * 100) / 100,
        currency: item.paraBirimi || 'TRY',
        paraBirimi: item.paraBirimi || 'TRY'
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
