const { SaleOrder, CustomerAccount, StockItem, sequelize } = require('../models');
const saleService = require('../src/services/saleService');

async function testNanPrevention() {
  try {
    await sequelize.sync({ alter: true });
    console.log('--- TESTING NAN & UNQUOTED SQL COLUMN ERROR PREVENTION ---');

    // 1. Test creating order with unselected or NaN stockItemId in itemsJson
    const rawItemsWithNan = [
      { stockItemId: 'NaN', stockCode: '', name: 'Özel Kalem 1', quantity: 2, unitPrice: 50, discountRate: 0, taxRate: 20, subtotal: 100, discountAmount: 0, taxAmount: 20, totalAmount: 120 },
      { stockItemId: null, stockCode: '', name: 'Özel Kalem 2', quantity: 1, unitPrice: 100, discountRate: 5, taxRate: 20, subtotal: 100, discountAmount: 5, taxAmount: 19, totalAmount: 114 }
    ];

    const nextOrderNo = await saleService.getNextOrderNo();
    const order = await saleService.createOrder({
      orderNo: nextOrderNo,
      customerName: 'Test NaN Müşteri',
      orderDate: '2026-08-10',
      paymentTerm: 'Vadeli_30',
      status: 'Preparing',
      priority: 'Normal',
      stockItemId: 'NaN', // <-- Should be converted safely to null
      quantity: 2,
      unitPrice: 50,
      discountRate: 0,
      subtotal: 200,
      discountAmount: 5,
      taxAmount: 39,
      totalAmount: 234,
      currency: 'TRY',
      itemsJson: JSON.stringify(rawItemsWithNan)
    });

    console.log('Created Order with NaN safety:', order.orderNo);
    console.log('Order stockItemId in DB:', order.stockItemId);

    if (order.stockItemId === null && order.orderNo) {
      console.log('SUCCESS: "column nan does not exist" error COMPLETELY PREVENTED and order created safely!');
    } else {
      console.error('FAILED: Order stockItemId was not null');
    }

    // Clean up test order
    await SaleOrder.destroy({ where: { id: order.id } });
    console.log('SUCCESS: Test order cleaned up!');

    process.exit(0);
  } catch (err) {
    console.error('Test Error:', err);
    process.exit(1);
  }
}

testNanPrevention();
