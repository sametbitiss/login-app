const { SaleQuotation, SaleOrder, sequelize } = require('../models');
const quotationRepository = require('../src/repositories/quotationRepository');
const saleService = require('../src/services/saleService');

async function testDirectConversion() {
  try {
    await sequelize.sync({ alter: true });
    console.log('--- TESTING DIRECT QUOTE CREATION AND CONVERSION FLOW ---');

    // 1. Create a normal quote (no high discount)
    const processedItems = [{
      stockItemId: 1,
      stockCode: 'STK-0001',
      name: 'Standart Vana',
      quantity: 1,
      unitPrice: 100,
      discountRate: 10, // <= 20%
      taxRate: 20,
      subtotal: 100,
      discountAmount: 10,
      taxAmount: 18,
      totalAmount: 108
    }];

    const normalQuote = await quotationRepository.create({
      quotationNo: `TEST-NORM-${Date.now()}`,
      customerName: 'Test Normal Müşteri A.Ş.',
      quotationDate: '2026-08-10',
      validUntil: '2026-08-25',
      stockItemId: 1,
      quantity: 1,
      unitPrice: 100,
      discountRate: 10,
      subtotal: 100,
      discountAmount: 10,
      taxAmount: 18,
      totalAmount: 108,
      currency: 'TRY',
      approvalNeeded: false,
      itemsJson: JSON.stringify(processedItems)
    });

    console.log('Created Normal Quote ID:', normalQuote.id);
    console.log('Quote Status:', normalQuote.status);
    console.log('Approval Needed:', normalQuote.approvalNeeded);

    if (normalQuote.status === 'Approved' && !normalQuote.approvalNeeded) {
      console.log('SUCCESS: Quote without high discount is directly APPROVED!');
    } else {
      console.error('FAILED: Quote status was not Approved');
    }

    // 2. Convert quote directly to order
    const nextOrderNo = await saleService.getNextOrderNo();
    const order = await saleService.createOrder({
      orderNo: nextOrderNo,
      customerId: normalQuote.customerId,
      customerName: normalQuote.customerName,
      orderDate: new Date().toISOString().split('T')[0],
      paymentTerm: 'Vadeli_30',
      status: 'Preparing',
      priority: 'Normal',
      stockItemId: normalQuote.stockItemId,
      quantity: normalQuote.quantity,
      unitPrice: normalQuote.unitPrice,
      discountRate: normalQuote.discountRate,
      taxRate: normalQuote.taxRate,
      subtotal: normalQuote.subtotal,
      discountAmount: normalQuote.discountAmount,
      taxAmount: normalQuote.taxAmount,
      totalAmount: normalQuote.totalAmount,
      currency: normalQuote.currency,
      itemsJson: normalQuote.itemsJson,
      salesRep: 'System Test',
      notes: `[Teklif No: ${normalQuote.quotationNo}] Teklif doğrudan siparişe dönüştürüldü.`
    });

    await quotationRepository.updateStatus(normalQuote.id, 'Converted', 'Siparişe dönüştürüldü');

    console.log('Created Order No:', order.orderNo);
    console.log('Order Status:', order.status);

    if (order.status === 'Preparing' || order.status === 'Hazırlanıyor') {
      console.log('SUCCESS: Direct quote conversion created Order with status "Hazırlanıyor"!');
    }

    // Clean up test data as required
    console.log('--- CLEANING UP TEST DATA ---');
    await SaleOrder.destroy({ where: { id: order.id } });
    await SaleQuotation.destroy({ where: { id: normalQuote.id } });
    console.log('SUCCESS: All test data cleaned up!');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testDirectConversion();
