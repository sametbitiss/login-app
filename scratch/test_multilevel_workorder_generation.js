const { sequelize, StockItem, BOMItem, RoutingOperation, ProductionOrder } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');
const productionRepository = require('../src/repositories/productionRepository');

async function testMultiLevelWorkOrderGeneration() {
  try {
    console.log('\n=== TEST: ÇOK SEVİYELİ İŞ EMRİ VE ROTA ÖNCELİKLENDİRME TESTİ ===\n');

    // 1. Create stock items
    const timeId = Date.now().toString().slice(-4);
    
    // Level 1 Finished Good
    const mainProduct = await stockRepository.create({
      stockCode: 'MAM-WO-' + timeId,
      name: 'Test Nihai Mamul A',
      category: 'Mamul',
      procurementMethod: 'Üretim',
      unit: 'Adet',
      status: 'Active'
    });

    // Level 2 Sub-assembly Yarı Mamul
    const subProduct = await stockRepository.create({
      stockCode: 'YM-WO-' + timeId,
      name: 'Test Alt Montaj Yarı Mamul B',
      category: 'Yarı_Mamul',
      procurementMethod: 'Üretim',
      unit: 'Adet',
      status: 'Active'
    });

    // Raw Material C
    const rawMaterial = await stockRepository.create({
      stockCode: 'HAM-WO-' + timeId,
      name: 'Test Sac Levha C',
      category: 'Hammadde',
      procurementMethod: 'Satın Alma',
      unit: 'Kg',
      status: 'Active'
    });

    console.log('1. Test Ürünleri Oluşturuldu:');
    console.log(`   - Main: [${mainProduct.stockCode}] ${mainProduct.name}`);
    console.log(`   - Sub : [${subProduct.stockCode}] ${subProduct.name}`);
    console.log(`   - Raw : [${rawMaterial.stockCode}] ${rawMaterial.name}`);

    // 2. Define BOMs
    // Main Product BOM (1 Main requires 1 Sub Product)
    await productionRepository.saveProductBOM(mainProduct.id, {
      version: 'Rev.01',
      baseQuantity: 1,
      components: [
        { componentStockItemId: subProduct.id, quantityRequired: 1, unit: 'Adet', level: 2 }
      ]
    });

    // Sub Product BOM (1 Sub requires 2.5 Kg Raw Material)
    await productionRepository.saveProductBOM(subProduct.id, {
      version: 'Rev.01',
      baseQuantity: 1,
      components: [
        { componentStockItemId: rawMaterial.id, quantityRequired: 2.5, unit: 'Kg', level: 3 }
      ]
    });

    console.log('\n2. Çok Seviyeli Reçeteler (BOM) Tanımlandı.');

    // 3. Define Routings for both
    await productionRepository.saveProductRouting(subProduct.id, [
      { operationSeq: 10, operationCode: 'OPS-10-KESIM', operationName: 'Sac Kesim & Büküm', workCenter: 'İstasyon-1 (Kesim & Büküm)', setupTimeMinutes: 30, runTimeMinutesPerUnit: 4 }
    ]);

    await productionRepository.saveProductRouting(mainProduct.id, [
      { operationSeq: 20, operationCode: 'OPS-20-MONTAJ', operationName: 'Nihai Scooter Montajı', workCenter: 'İstasyon-5 (Montaj & Test)', setupTimeMinutes: 15, runTimeMinutesPerUnit: 10 }
    ]);

    console.log('3. Ürün ve Alt Montaj Rotaları Tanımlandı.');

    // 4. Test Multi-Level Production Plan generation for 100 units of mainProduct
    const plan = await productionRepository.getMultiLevelProductionPlan(mainProduct.id, 100);

    console.log(`\n4. Üretim Planı Oluşturuldu (${plan.length} Elemanlı):`);
    plan.forEach((item, idx) => {
      console.log(`   ${idx + 1}. Sıra: [Seviye ${item.level}] [${item.product.stockCode}] ${item.product.name} — Miktar: ${item.plannedQuantity} ${item.product.unit} (Rota Adım Sayısı: ${item.routingOperations.length})`);
    });

    // Verify priority sorting (Level DESC)
    if (plan.length < 2) {
      throw new Error('HATA: Çok seviyeli üretim planı alt montajı içermiyor!');
    }
    if (plan[0].product.id !== subProduct.id || plan[0].level <= plan[1].level) {
      throw new Error('HATA: Üretim önceliği yanlış! Seviyesi büyük olan alt montaj (Seviye 2) ilk sırada olmalıydı!');
    }

    console.log('\n✅ BAŞARILI: Çok seviyeli iş emri hazırlama ve seviye önceliklendirme testi eksiksiz geçti!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST BAŞARISIZ:', err);
    process.exit(1);
  }
}

testMultiLevelWorkOrderGeneration();
