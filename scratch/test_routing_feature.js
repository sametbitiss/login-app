const { sequelize, StockItem, BOMItem, RoutingOperation } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');
const productionRepository = require('../src/repositories/productionRepository');

async function testRoutingFeature() {
  try {
    console.log('\n=== TEST: ÜRETİM ROTALAMA (PROCESS ENGINEERING) TESTİ ===\n');

    // 1. Create a test Mamul product with procurementMethod = 'Üretim'
    const testCode = 'MAM-ROTA-' + Date.now().toString().slice(-4);
    const mainProduct = await stockRepository.create({
      stockCode: testCode,
      name: 'Rota Test Mamulü',
      category: 'Mamul',
      procurementMethod: 'Üretim',
      unit: 'Adet',
      status: 'Active'
    });

    // 2. Create a component and define a BOM for mainProduct
    const rawItem = await stockRepository.create({
      stockCode: 'HAM-ROTA-' + Date.now().toString().slice(-4),
      name: 'Rota Sac Hammaddesi',
      category: 'Hammadde',
      procurementMethod: 'Satın Alma',
      unit: 'Kg',
      status: 'Active'
    });

    await productionRepository.saveProductBOM(mainProduct.id, {
      version: 'Rev.01',
      baseQuantity: 1,
      components: [
        {
          componentStockItemId: rawItem.id,
          quantityRequired: 3.5,
          unit: 'Kg',
          scrapPercentage: 2,
          level: 3
        }
      ]
    });

    console.log(`1. Reçeteli Mamul Ürün Oluşturuldu: [${mainProduct.stockCode}] ${mainProduct.name}`);

    // 3. Verify candidate products list before routing creation
    let routingsGrouped = await productionRepository.findAllRoutingsGroupedByProduct();
    let productEntry = routingsGrouped.find(r => r.product.id === mainProduct.id);

    if (!productEntry) {
      throw new Error('HATA: Reçeteli ürün Rotalar aday listesinde bulunamadı!');
    }

    console.log(`2. Rotalar Aday Listesinde Göründü: hasRouting = ${productEntry.hasRouting} (Beklenen: false)`);
    if (productEntry.hasRouting) {
      throw new Error('HATA: Henüz rota kaydedilmeden hasRouting = true oldu!');
    }

    // 4. Save a Routing with 2 operation steps and assigned components
    console.log('3. Ürün İçin Rota Operasyon Adımları Kaydediliyor...');
    await productionRepository.saveProductRouting(
      mainProduct.id,
      [
        {
          operationSeq: 10,
          operationCode: 'OPS-10-KESİM',
          operationName: 'Lazer Kesim ve Sac Büküm',
          workCenter: 'İstasyon-1 (Kesim & Büküm)',
          setupTimeMinutes: 30,
          runTimeMinutesPerUnit: 6.5,
          operatorCount: 2,
          instructions: 'Kesim yapılan sac parçaların çapaksız büküldüğü mikrometre ile ölçülecek.',
          usedComponents: [rawItem.stockCode]
        },
        {
          operationSeq: 20,
          operationCode: 'OPS-20-KAYNAK',
          operationName: 'Robotik Gazaltı Kaynağı',
          workCenter: 'İstasyon-2 (Kaynak & Sac İşleme)',
          setupTimeMinutes: 20,
          runTimeMinutesPerUnit: 4.0,
          operatorCount: 1,
          instructions: 'Kaynak nüfuziyeti %100 tahribatsız muayene ile kontrol edilecek.',
          usedComponents: [rawItem.stockCode]
        }
      ]
    );

    // 5. Verify candidate products list after routing creation
    routingsGrouped = await productionRepository.findAllRoutingsGroupedByProduct();
    productEntry = routingsGrouped.find(r => r.product.id === mainProduct.id);

    console.log(`4. Rota Kaydedildikten Sonra Durum:`);
    console.log(`   - hasRouting: ${productEntry.hasRouting} (Beklenen: true)`);
    console.log(`   - Operasyon Adım Sayısı: ${productEntry.totalOperations} (Beklenen: 2)`);
    console.log(`   - Toplam Ayar Süresi: ${productEntry.totalSetupTime} Dk`);
    console.log(`   - Birim İşlem Süresi: ${productEntry.totalRunTime} Dk / Adet`);

    if (!productEntry.hasRouting || productEntry.totalOperations !== 2) {
      throw new Error('HATA: Rota kaydedildikten sonra operasyon adımları veya hasRouting yanlış!');
    }

    console.log('\n✅ BAŞARILI: Rotalama (Process Engineering) testleri eksiksiz geçti!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST BAŞARISIZ:', err);
    process.exit(1);
  }
}

testRoutingFeature();
