const { sequelize, User, StockItem, PurchaseOrder } = require('../models');
const purchaseService = require('../src/services/purchaseService');

async function testPurchase() {
  try {
    console.log('Testing Purchase module integration...');

    await sequelize.sync({ alter: true });
    console.log('DB synced successfully.');

    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      console.error('Admin user not found');
      return;
    }

    const stock = await StockItem.findOne();
    if (!stock) {
      console.error('Stock item not found');
      return;
    }

    const nextOrderNo = await purchaseService.getNextOrderNo();
    console.log('Generated Purchase Order No:', nextOrderNo);

    const testOrder = await purchaseService.createOrder({
      orderNo: nextOrderNo,
      supplierName: 'Test Tedarikçi Sanayi A.Ş.',
      supplierTaxNo: '9998887776',
      supplierContactPerson: 'Ali Bey',
      supplierEmail: 'tedarik@test.com',
      supplierPhone: '+90 212 999 88 77',
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: '2026-08-25',
      paymentTerm: 'Vadeli_60',
      status: 'Received',
      priority: 'Normal',
      stockItemId: stock.id,
      quantity: 10,
      unitPrice: 200,
      discountRate: 5, // 100 TL discount on 2000 => 1900
      taxRate: 20, // 20% VAT on 1900 => 380 TL
      currency: 'TRY',
      deliveryWarehouse: 'Depo-A (Hammadde Ambarı)',
      purchasingAgent: 'Caner Öztürk',
      notes: 'Test satın alma sipariş notu'
    }, admin, '127.0.0.1');

    console.log('Test Purchase Order Created:', {
      id: testOrder.id,
      orderNo: testOrder.orderNo,
      subtotal: testOrder.subtotal, // 2000
      discountAmount: testOrder.discountAmount, // 100
      taxAmount: testOrder.taxAmount, // 380
      totalAmount: testOrder.totalAmount // 2280
    });

    const stats = await purchaseService.getStats();
    console.log('Purchase Stats:', stats);

    console.log('Purchase module test completed SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('Purchase Test Failed:', err);
    process.exit(1);
  }
}

testPurchase();
