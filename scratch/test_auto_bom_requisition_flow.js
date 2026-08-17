const { sequelize, StockItem, ProductionOrder, BOMItem } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');
const productionRepository = require('../src/repositories/productionRepository');

async function testAutoBOMRequisitionFlow() {
  try {
    console.log('\n=== TEST: OTOMATİK REÇETE TALEBİ OLUŞTURMA VE TAMAMLAMA FLOWU ===\n');

    // 1. Create a new test StockItem of category 'Mamul'
    const testCode = 'MAM-TEST-' + Date.now().toString().slice(-4);
    const newStockItem = await stockRepository.create({
      stockCode: testCode,
      name: 'Otomatik Reçete Test Mamulü',
      category: 'Mamul',
      procurementMethod: 'Üretim',
      unit: 'Adet',
      currentStock: 10,
      minStock: 2,
      purchasePrice: 50,
      salePrice: 120,
      status: 'Active'
    });

    console.log(`1. Stok & Depo Modülünde Yeni Mamul Oluşturuldu: [${newStockItem.stockCode}] ${newStockItem.name}`);

    // 2. Check if a BOM Requisition was automatically created
    const req = await ProductionOrder.findOne({
      where: { stockItemId: newStockItem.id }
    });

    if (!req) {
      throw new Error('HATA: Otomatik Reçete Talebi oluşturulamadı!');
    }

    console.log(`2. Üretim Modülünde Otomatik Reçete Talebi Oluşturuldu:`);
    console.log(`   - Talep Kodu: ${req.workOrderNo}`);
    console.log(`   - Talep Başlığı: ${req.productionTitle}`);
    console.log(`   - Durum: ${req.status}`);

    // 3. Create a raw material component stock item
    const rawCode = 'HAM-TEST-' + Date.now().toString().slice(-4);
    const rawItem = await stockRepository.create({
      stockCode: rawCode,
      name: 'Test Hammaddesi',
      category: 'Hammadde',
      unit: 'Kg',
      purchasePrice: 15,
      status: 'Active'
    });

    // 4. Save a BOM for the newly created Mamul
    console.log(`3. [${newStockItem.stockCode}] için Reçete Kaydediliyor...`);
    await productionRepository.saveProductBOM(
      newStockItem.id,
      'Rev.01',
      1,
      [
        {
          componentStockItemId: rawItem.id,
          quantityRequired: 2,
          unit: rawItem.unit,
          scrapPercentage: 0,
          level: 3
        }
      ]
    );

    // 5. Check if the BOM Requisition status updated to Completed
    await req.reload();
    console.log(`4. Reçete Kaydedildikten Sonra Talep Durumu: ${req.status}`);

    if (req.status !== 'Completed') {
      throw new Error('HATA: Reçete oluşturulduktan sonra talep durumu Tamamlandı (Completed) olmadı!');
    }

    console.log('\n✅ BAŞARILI: Otomatik Reçete Talebi oluşturma ve tamamlama testi eksiksiz geçti!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST BAŞARISIZ:', err);
    process.exit(1);
  }
}

testAutoBOMRequisitionFlow();
