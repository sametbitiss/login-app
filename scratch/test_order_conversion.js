const { SaleQuotation, SaleOrder, sequelize } = require('../models');
const quotationRepository = require('../src/repositories/quotationRepository');
const saleService = require('../src/services/saleService');

async function testOrderConversion() {
  try {
    await sequelize.sync({ alter: true });
    console.log('--- TESTING CONVERT QUOTE TO ORDER FLOW ---');

    const processedItems = [
      {
        stockItemId: 1,
        stockCode: 'STK-0001',
        name: 'Endüstriyel Vana A-100',
        quantity: 2,
        unitPrice: 500,
        discountRate: 10,
        taxRate: 20,
        subtotal: 1000,
        discountAmount: 100,
        taxAmount: 180,
        totalAmount: 1080
      },
      {
        stockItemId: 2,
        stockCode: 'STK-0002',
        name: 'Paslanmaz Çelik Cıvata',
        quantity: 5,
        unitPrice: 100,
        discountRate: 5,
        taxRate: 20,
        subtotal: 500,
        discountAmount: 25,
        taxAmount: 95,
        totalAmount: 570
      }
    ];

    // Create approved test quote
    const testQuote = await quotationRepository.create({
      quotationNo: `TEST-CONV-${Date.now()}`,
      customerName: 'Test Firma A.Ş.',
      quotationDate: '2026-08-10',
      validUntil: '2026-08-25',
      stockItemId: 1,
      quantity: 2,
      unitPrice: 500,
      discountRate: 10,
      subtotal: 1500,
      discountAmount: 125,
      taxAmount: 275,
      totalAmount: 1650,
      currency: 'TRY',
      approvalNeeded: false,
      status: 'Approved',
      itemsJson: JSON.stringify(processedItems)
    });

    console.log('Created Approved Quote:', testQuote.quotationNo);

    // Convert to order
    const nextOrderNo = await saleService.getNextOrderNo();
    const order = await saleService.createOrder({
      orderNo: nextOrderNo,
      customerId: testQuote.customerId,
      customerName: testQuote.customerName,
      orderDate: new Date().toISOString().split('T')[0],
      paymentTerm: 'Vadeli_30',
      status: 'Preparing',
      priority: 'Normal',
      stockItemId: testQuote.stockItemId,
      quantity: testQuote.quantity,
      unitPrice: testQuote.unitPrice,
      discountRate: testQuote.discountRate,
      taxRate: testQuote.taxRate,
      subtotal: testQuote.subtotal,
      discountAmount: testQuote.discountAmount,
      taxAmount: testQuote.taxAmount,
      totalAmount: testQuote.totalAmount,
      currency: testQuote.currency,
      itemsJson: testQuote.itemsJson,
      salesRep: 'System Test',
      notes: `[Teklif No: ${testQuote.quotationNo}] Teklif onaylanarak siparişe dönüştürüldü.`
    });

    console.log('Created Order:', order.orderNo);
    console.log('Order Status:', order.status);
    console.log('Order ItemsJson length:', order.itemsJson ? JSON.parse(order.itemsJson).length : 0);

    if ((order.status === 'Preparing' || order.status === 'Hazırlanıyor') && order.itemsJson && JSON.parse(order.itemsJson).length === 2) {
      console.log('SUCCESS: Order conversion test passed with "Hazırlanıyor" status & multi-item JSON!');
    } else {
      console.error('FAILED: Order conversion status or items mismatch');
    }

    // Clean up test data
    console.log('--- CLEANING UP TEST DATA ---');
    await SaleOrder.destroy({ where: { id: order.id } });
    await SaleQuotation.destroy({ where: { id: testQuote.id } });
    console.log('SUCCESS: All test data cleaned up!');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testOrderConversion();
