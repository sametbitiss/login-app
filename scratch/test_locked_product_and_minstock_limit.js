const { sequelize, StockItem, ProductionOrder } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');
const productionRepository = require('../src/repositories/productionRepository');
const productionController = require('../src/controllers/productionController');

async function testLockedProductAndMinStockLimit() {
  try {
    console.log('\n=== TEST: KİLİTLİ HEDEF ÜRÜN VE MİNİMUM STOK SINIRI TESTİ ===\n');

    // 1. Create a stock item with minStock = 75
    const testCode = 'MAM-MIN-' + Date.now().toString().slice(-4);
    const minStockItem = await stockRepository.create({
      stockCode: testCode,
      name: 'Min Stok Test Mamulü',
      category: 'Mamul',
      procurementMethod: 'Üretim',
      minStock: 75, // Minimum Stock Level set to 75
      unit: 'Adet',
      status: 'Active'
    });

    console.log(`1. Stok Kartı Oluşturuldu: [${minStockItem.stockCode}] ${minStockItem.name} — minStock: ${minStockItem.minStock} Adet`);

    // 2. Simulate renderAddOrder with requisition/stockItemId conversion
    const req = {
      user: { id: 1, username: 'admin', role: 'Admin' },
      query: { stockItemId: minStockItem.id, plannedQty: 20 } // User passed 20 (below 75 minStock)
    };

    let renderedData = null;
    const res = {
      render: (viewName, data) => {
        renderedData = data;
      }
    };

    await new Promise((resolve, reject) => {
      productionController.renderAddOrder(req, res, (err) => {
        if (err) return reject(err);
        resolve();
      });
      setTimeout(resolve, 500);
    });

    console.log('\n2. İş Emri Hazırlama Ekranı Verileri Hesaplandı:');
    console.log(`   - isLockedProduct : ${renderedData.isLockedProduct} (Beklenen: true)`);
    console.log(`   - Target Product  : ${renderedData.targetProduct ? renderedData.targetProduct.name : 'YOK'}`);
    console.log(`   - minStockLimit   : ${renderedData.minStockLimit} Adet (Beklenen: 75)`);
    console.log(`   - effectiveQty    : ${renderedData.effectiveQty} Adet (Beklenen: 75 — 20 miktarı 75 seviyesine yükseltilmeli)`);

    if (!renderedData.isLockedProduct) {
      throw new Error('HATA: Üretim talebine basıldığında ürün kilitlenmedi (isLockedProduct = false)!');
    }
    if (renderedData.minStockLimit !== 75) {
      throw new Error(`HATA: minStockLimit 75 olması gerekirken ${renderedData.minStockLimit} oldu!`);
    }
    if (renderedData.effectiveQty < 75) {
      throw new Error(`HATA: Üretim miktarı minimum stok seviyesinin (75) altına indi: ${renderedData.effectiveQty}!`);
    }

    console.log('\n✅ BAŞARILI: Kilitli ürün ve minimum stok alt sınır kuralı testi %100 geçti!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST BAŞARISIZ:', err);
    process.exit(1);
  }
}

testLockedProductAndMinStockLimit();
