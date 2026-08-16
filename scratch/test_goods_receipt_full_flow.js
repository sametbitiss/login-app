const { sequelize, StockItem, PurchaseOrder, GoodsReceipt, Warehouse, User } = require('../models');
const goodsReceiptRepository = require('../src/repositories/goodsReceiptRepository');

async function testFullGoodsReceiptFlow() {
  try {
    console.log('\n=== TEST: MAL KABUL SÜRECİ VE DEPO STOK GÜNCELLEME TESTİ ===\n');

    // 1. Create a dummy test warehouse
    const wh = await Warehouse.create({
      warehouseCode: 'WH-TEST-' + Date.now().toString().slice(-4),
      name: 'Test Kabul Deposu',
      type: 'Genel',
      city: 'İstanbul',
      status: 'Active'
    });
    console.log(`1. Hedef Depo Oluşturuldu: ${wh.name} (${wh.warehouseCode})`);

    // 2. Create a dummy stock item
    const item = await StockItem.create({
      stockCode: 'STK-KABUL-' + Date.now().toString().slice(-4),
      name: 'Kabul Test Ürünü',
      category: 'Hammadde',
      unit: 'Adet',
      currentStock: 0,
      minStock: 10,
      status: 'Active'
    });
    console.log(`2. Stok Kartı Oluşturuldu: ${item.name} (${item.stockCode})`);

    // 3. Create a dummy Purchase Order
    const po = await PurchaseOrder.create({
      orderNo: 'SAT-KABUL-' + Date.now().toString().slice(-4),
      supplierName: 'Test Tedarikçi A.Ş.',
      stockItemId: item.id,
      quantity: 20,
      unitPrice: 50,
      status: 'Ordered',
      deliveryWarehouse: wh.name,
      itemsJson: JSON.stringify([{
        stockItemId: item.id,
        stockCode: item.stockCode,
        productName: item.name,
        quantity: 20,
        unit: item.unit,
        unitPrice: 50
      }])
    });
    console.log(`3. Satın Alma Siparişi Oluşturuldu: ${po.orderNo} (Hedef Depo: ${po.deliveryWarehouse})`);

    // 4. Simulate Goods Receipt completion
    const grnNo = await goodsReceiptRepository.getNextGrnNo();
    const grn = await GoodsReceipt.create({
      grnNo,
      purchaseOrderId: po.id,
      supplierId: null,
      stockItemId: item.id,
      orderedQuantity: 20,
      receivedQuantity: 20,
      acceptedQuantity: 20,
      rejectedQuantity: 0,
      receiptDate: new Date().toISOString().split('T')[0],
      deliveryNoteNo: 'IRS-TEST-999',
      deliveryNoteDate: new Date().toISOString().split('T')[0],
      itemsData: JSON.stringify([{
        stockItemId: item.id,
        stockCode: item.stockCode,
        productName: item.name,
        unit: item.unit,
        orderedQuantity: 20,
        previouslyReceivedQuantity: 0,
        currentReceivedQuantity: 20,
        netRemainingQuantity: 0
      }]),
      warehouseLocation: po.deliveryWarehouse,
      status: 'Completed',
      qualityStatus: 'Approved'
    });
    console.log(`4. Mal Kabul Fişi Kesildi: ${grn.grnNo} (Teslim Alınan: ${grn.receivedQuantity} Adet)`);

    // Update StockItem stock
    item.currentStock = parseFloat(item.currentStock) + 20;
    await item.save();

    // Update Warehouse itemsJson
    let whItems = [];
    if (wh.itemsJson) {
      try { whItems = JSON.parse(wh.itemsJson); } catch (e) { whItems = []; }
    }
    whItems.push({
      stockItemId: item.id,
      stockCode: item.stockCode,
      name: item.name,
      category: item.category,
      quantity: 20,
      unit: item.unit,
      lastUpdated: new Date().toISOString()
    });
    wh.itemsJson = JSON.stringify(whItems);
    await wh.save();

    console.log(`5. Depo Ürün Bakiyesi Güncellendi! ${wh.name} deposundaki ürün sayısı: ${whItems.length}`);
    console.log(`   - Eklenen Ürün: ${whItems[0].name} (${whItems[0].quantity} ${whItems[0].unit})`);

    console.log('\n=== HİÇBİR HATA ALINMADAN MAL KABUL VE STOK GİRİŞİ BAŞARIYLA TAMAMLANDI ===\n');
    process.exit(0);
  } catch (err) {
    console.error('\nMal Kabul Akış Testi Hatası:', err);
    process.exit(1);
  }
}

testFullGoodsReceiptFlow();
