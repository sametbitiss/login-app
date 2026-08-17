const { sequelize, StockItem, ProductionOrder, Warehouse } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');
const productionRepository = require('../src/repositories/productionRepository');

async function testWarehouseAndProcurementRules() {
  try {
    console.log('\n=== TEST: DİNAMİK DEPO VE TEDARİK YÖNTEMİ KURALLARI TESTİ ===\n');

    // 1. Fetch warehouses
    const warehouses = await stockRepository.findAllWarehouses();
    console.log(`1. Sistemdeki Aktif Depo Sayısı: ${warehouses.length}`);
    warehouses.forEach(w => console.log(`   - [${w.warehouseCode}] ${w.name} (${w.type})`));

    const defaultWhName = warehouses.length > 0 ? warehouses[0].name : 'Ana Depo';

    // 2. Test Hammadde item creation (procurementMethod must be forced to 'Satın Alma')
    const hamCode = 'HAM-RULE-' + Date.now().toString().slice(-4);
    const hamItem = await stockRepository.create({
      stockCode: hamCode,
      name: 'Kural Test Hammaddesi',
      category: 'Hammadde',
      procurementMethod: 'Üretim', // Should be overridden to Satın Alma
      warehouseLocation: defaultWhName,
      unit: 'Kg',
      status: 'Active'
    });

    console.log(`\n2. Hammadde Stok Kartı Oluşturuldu:`);
    console.log(`   - Adı: ${hamItem.name}`);
    console.log(`   - Kategori: ${hamItem.category}`);
    console.log(`   - Tedarik Yöntemi: ${hamItem.procurementMethod} (Beklenen: Satın Alma)`);
    console.log(`   - Varsayılan Depo: ${hamItem.warehouseLocation}`);

    if (hamItem.procurementMethod !== 'Satın Alma') {
      throw new Error('HATA: Hammadde ürününün tedarik yöntemi Satın Alma olmadı!');
    }

    // 3. Test Yarı Mamul with Satın Alma (Should NOT create automatic BOM requisition)
    const yariPurchasedCode = 'YM-PURCH-' + Date.now().toString().slice(-4);
    const yariPurchased = await stockRepository.create({
      stockCode: yariPurchasedCode,
      name: 'Satın Alınan Dış Yarı Mamul',
      category: 'Yarı_Mamul',
      procurementMethod: 'Satın Alma',
      warehouseLocation: defaultWhName,
      unit: 'Adet',
      status: 'Active'
    });

    const reqPurchased = await ProductionOrder.findOne({ where: { stockItemId: yariPurchased.id } });
    console.log(`\n3. Satın Alınan Yarı Mamul Oluşturuldu:`);
    console.log(`   - Tedarik Yöntemi: ${yariPurchased.procurementMethod}`);
    console.log(`   - Otomatik Reçete Talebi Açıldı mı?: ${reqPurchased ? 'EVET (HATA!)' : 'HAYIR (DOĞRU!)'}`);

    if (reqPurchased) {
      throw new Error('HATA: Satın alınan Yarı Mamul için reçete talebi açılmamalıydı!');
    }

    // 4. Test Mamul with Üretim (SHOULD create automatic BOM requisition)
    const mamProducedCode = 'MAM-PROD-' + Date.now().toString().slice(-4);
    const mamProduced = await stockRepository.create({
      stockCode: mamProducedCode,
      name: 'İmal Edilen Üretim Mamulü',
      category: 'Mamul',
      procurementMethod: 'Üretim',
      warehouseLocation: defaultWhName,
      unit: 'Adet',
      status: 'Active'
    });

    const reqProduced = await ProductionOrder.findOne({ where: { stockItemId: mamProduced.id } });
    console.log(`\n4. İmal Edilen Mamul Oluşturuldu:`);
    console.log(`   - Tedarik Yöntemi: ${mamProduced.procurementMethod}`);
    console.log(`   - Otomatik Reçete Talebi Açıldı mı?: ${reqProduced ? 'EVET (DOĞRU!)' : 'HAYIR (HATA!)'}`);
    if (reqProduced) {
      console.log(`   - Talep Kodu: ${reqProduced.workOrderNo}`);
    }

    if (!reqProduced) {
      throw new Error('HATA: İmal edilen Mamul için otomatik reçete talebi açılmalıydı!');
    }

    // 5. Test BOM grouped product list filtering (only procurementMethod = Üretim)
    const bomList = await productionRepository.findAllBOMGroupedByProduct();
    const foundPurchasedInBOM = bomList.some(p => p.product.id === yariPurchased.id);
    const foundProducedInBOM = bomList.some(p => p.product.id === mamProduced.id);

    console.log(`\n5. Reçeteler (BOM) Ürün Listesi Filtrelemesi:`);
    console.log(`   - Satın Alınan Yarı Mamul Reçete Hedef Listesinde var mı?: ${foundPurchasedInBOM ? 'EVET (HATA!)' : 'HAYIR (DOĞRU!)'}`);
    console.log(`   - İmal Edilen Mamul Reçete Hedef Listesinde var mı?: ${foundProducedInBOM ? 'EVET (DOĞRU!)' : 'HAYIR (HATA!)'}`);

    if (foundPurchasedInBOM) {
      throw new Error('HATA: Satın alınan ürün reçete hedef listesinde görünmemeliydi!');
    }
    if (!foundProducedInBOM) {
      throw new Error('HATA: İmal edilen ürün reçete hedef listesinde görünmeliydi!');
    }

    console.log('\n✅ BAŞARILI: Tüm dinamik depo ve tedarik yöntemi iş kuralları testi eksiksiz geçti!\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ TEST BAŞARISIZ:', err);
    process.exit(1);
  }
}

testWarehouseAndProcurementRules();
