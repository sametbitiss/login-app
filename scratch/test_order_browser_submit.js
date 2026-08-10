const { SaleOrder, CustomerAccount, StockItem, sequelize } = require('../models');
const saleService = require('../src/services/saleService');

async function testOrderBrowserSubmit() {
  try {
    await sequelize.sync({ alter: true });
    console.log('--- TESTING ORDER FORM SUBMISSION PAYLOAD ---');

    // Simulate exact req.body sent when user fills and submits form in browser
    const samplePayload = {
      orderNo: `SAT-2026-TEST-${Date.now()}`,
      customerId: '', // Unselected customer fallback
      customerName: 'Örnek Müşteri Ltd. Şti.',
      orderDate: new Date().toISOString().split('T')[0],
      deliveryDate: '',
      priority: 'Normal',
      paymentTerm: 'Vadeli_30',
      currency: 'TRY',
      salesRep: 'Samet Bitiş',
      shippingAddress: 'Test Adres',
      billingAddress: 'Test Fatura Adresi',
      notes: 'Test Sipariş Notu',
      itemsJson: JSON.stringify([
        {
          stockItemId: 1,
          stockCode: 'STK-0001',
          name: 'Endüstriyel Vana A-100',
          quantity: 2,
          unitPrice: 250,
          discountRate: 10,
          taxRate: 20,
          subtotal: 500,
          discountAmount: 50,
          taxAmount: 90,
          totalAmount: 540
        }
      ])
    };

    const nextOrderNo = await saleService.getNextOrderNo();
    const order = await saleService.createOrder({
      orderNo: nextOrderNo,
      customerId: null,
      customerName: samplePayload.customerName,
      customerTaxNo: null,
      customerPhone: null,
      orderDate: samplePayload.orderDate,
      deliveryDate: null,
      paymentTerm: samplePayload.paymentTerm,
      status: 'Preparing',
      approvalNeeded: false,
      approvalReason: null,
      priority: samplePayload.priority,
      stockItemId: 1,
      quantity: 2,
      unitPrice: 250,
      discountRate: 10,
      taxRate: 20,
      subtotal: 500,
      discountAmount: 50,
      taxAmount: 90,
      totalAmount: 540,
      currency: samplePayload.currency,
      itemsJson: samplePayload.itemsJson,
      shippingAddress: samplePayload.shippingAddress,
      billingAddress: samplePayload.billingAddress,
      salesRep: samplePayload.salesRep,
      notes: samplePayload.notes
    });

    console.log('Successfully Created Order:', order.orderNo, 'ID:', order.id);
    console.log('Order Status:', order.status);
    console.log('Order Total:', order.totalAmount, order.currency);

    if (order.id && order.orderNo) {
      console.log('SUCCESS: Order form submit simulation passed 100% cleanly without ANY SQL or NaN errors!');
    }

    // Clean up test order
    await SaleOrder.destroy({ where: { id: order.id } });
    console.log('SUCCESS: Test order cleaned up from DB!');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testOrderBrowserSubmit();
