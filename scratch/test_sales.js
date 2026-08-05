const { sequelize, User, StockItem, SaleOrder } = require('../models');
const saleService = require('../src/services/saleService');

async function testSales() {
  try {
    console.log('Testing Sales module integration...');

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

    const nextOrderNo = await saleService.getNextOrderNo();
    console.log('Generated Order No:', nextOrderNo);

    const testOrder = await saleService.createOrder({
      orderNo: nextOrderNo,
      customerName: 'Test Müşteri Ltd. Şti.',
      customerTaxNo: '1112223334',
      customerEmail: 'test@musteri.com',
      customerPhone: '+90 555 111 22 33',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '2026-08-20',
      paymentTerm: 'Vadeli_30',
      status: 'Approved',
      priority: 'High',
      stockItemId: stock.id,
      quantity: 5,
      unitPrice: 100,
      discountRate: 10, // 50 TL discount
      taxRate: 20, // 20% VAT on 450 = 90 TL
      currency: 'TRY',
      shippingAddress: 'Test Adres',
      billingAddress: 'Test Fatura Adresi',
      salesRep: 'Ahmet Yılmaz',
      notes: 'Test sipariş notu'
    }, admin, '127.0.0.1');

    console.log('Test Order Created:', {
      id: testOrder.id,
      orderNo: testOrder.orderNo,
      subtotal: testOrder.subtotal, // 500
      discountAmount: testOrder.discountAmount, // 50
      taxAmount: testOrder.taxAmount, // 90
      totalAmount: testOrder.totalAmount // 540
    });

    const stats = await saleService.getStats();
    console.log('Sales Stats:', stats);

    console.log('Sales module test completed SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('Sales Test Failed:', err);
    process.exit(1);
  }
}

testSales();
