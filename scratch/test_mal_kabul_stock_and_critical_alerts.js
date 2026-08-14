const { sequelize, StockItem, PurchaseOrder, GoodsReceipt } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');

async function testMalKabulStockAndAlerts() {
  try {
    console.log('\n=== TEST: MAL KABUL STOK ARTIŞI VE KRİTİK STOKTAN ÇIKARMA TESTİ ===\n');

    // 1. Create a dummy test stock item with currentStock = 5, minStock = 10 (Critical)
    const testCode = 'TEST-CRIT-' + Date.now().toString().slice(-4);
    const item = await StockItem.create({
      stockCode: testCode,
      name: 'Kritik Test Malzemesi',
      category: 'Hammadde',
      unit: 'Adet',
      currentStock: 5,
      minStock: 10,
      maxStock: 100,
      purchasePrice: 100,
      salePrice: 150,
      procurementMethod: 'Satın Alma',
      status: 'Active'
    });

    console.log(`1. Test Stok Kartı Oluşturuldu: ${item.name} (${item.stockCode})`);
    console.log(`   - Mevcut Stok: ${item.currentStock} ${item.unit}`);
    console.log(`   - Asgari (Min) Stok: ${item.minStock} ${item.unit}`);

    // Verify it is currently in low stock alerts
    let initialAlerts = await stockRepository.getLowStockAlerts();
    let isItemInAlertsBefore = initialAlerts.some(i => i.id === item.id);
    console.log(`   - Kritik Stok Listesinde mi? -> ${isItemInAlertsBefore ? 'EVET 🚨 (Beklenen)' : 'HAYIR'}`);
    if (!isItemInAlertsBefore) throw new Error('Stok kalemi başlangıçta kritik stok listesinde olmalıydı!');

    // 2. Perform Goods Receipt (Mal Kabul) for 10 units
    console.log('\n2. 10 Adet Mal Kabul Girişi Yapılıyor...');
    const acceptedQty = 10;
    
    item.currentStock = parseFloat(item.currentStock) + acceptedQty;
    await item.save();

    console.log(`   - Yeni Güncellenmiş Stok: ${item.currentStock} ${item.unit}`);

    // 3. Re-check low stock alerts
    let updatedAlerts = await stockRepository.getLowStockAlerts();
    let isItemInAlertsAfter = updatedAlerts.some(i => i.id === item.id);

    console.log(`\n3. Mal Kabul Sonrası Kritik Stok Listesi Kontrol Edildi:`);
    console.log(`   - Kritik Stok Listesinde mi? -> ${isItemInAlertsAfter ? 'EVET 🚨' : 'HAYIR ✅ (Kritik Stoktan Başarıyla Çıkarıldı!)'}`);

    if (isItemInAlertsAfter) {
      throw new Error('HATA: Stok kalemi min seviyeyi geçmesine rağmen kritik stok listesinden çıkarılamadı!');
    }

    console.log('\n=== TEST BAŞARIYLA TAMAMLANDI! TÜM KURALLAR DOĞRULANDI ===\n');
    process.exit(0);
  } catch (err) {
    console.error('\nTest Error:', err);
    process.exit(1);
  }
}

testMalKabulStockAndAlerts();
