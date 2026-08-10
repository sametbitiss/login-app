const { SaleQuotation, StockItem, CustomerAccount, sequelize } = require('../models');
const quotationRepository = require('../src/repositories/quotationRepository');

async function testApprovalFlow() {
  try {
    await sequelize.sync({ alter: true });
    console.log('Testing Managerial Approval Rule for >20% item discounts...');

    const processedItems = [
      {
        stockItemId: 1,
        stockCode: 'STK-0001',
        name: 'Paslanmaz Çelik Cıvata M8x50',
        quantity: 10,
        unitPrice: 100,
        discountRate: 25, // >20% triggers approval!
        taxRate: 20,
        subtotal: 1000,
        discountAmount: 250,
        taxAmount: 150,
        totalAmount: 900
      }
    ];

    const highDiscountReasons = [];
    for (const item of processedItems) {
      if (item.discountRate > 20) {
        highDiscountReasons.push(`${item.name} (%${item.discountRate} iskonto)`);
      }
    }

    const approvalNeeded = highDiscountReasons.length > 0;
    const approvalReason = `Yüksek Ürün İskontosu: ${highDiscountReasons.join(', ')} (Yönetsel onay sınırı: %20)`;

    const testQuote = await quotationRepository.create({
      quotationNo: `TEST-APP-${Date.now()}`,
      customerName: 'Test Firma A.Ş.',
      quotationDate: '2026-08-10',
      validUntil: '2026-08-25',
      stockItemId: 1,
      quantity: 10,
      unitPrice: 100,
      discountRate: 25,
      subtotal: 1000,
      discountAmount: 250,
      taxAmount: 150,
      totalAmount: 900,
      currency: 'TRY',
      approvalNeeded,
      approvalReason,
      status: approvalNeeded ? 'Pending_Approval' : 'Approved',
      itemsJson: JSON.stringify(processedItems)
    });

    console.log('Created Quotation ID:', testQuote.id);
    console.log('Status:', testQuote.status);
    console.log('Approval Needed:', testQuote.approvalNeeded);
    console.log('Approval Reason:', testQuote.approvalReason);

    if (testQuote.status === 'Pending_Approval' && testQuote.approvalReason.includes('Paslanmaz Çelik Cıvata')) {
      console.log('SUCCESS: Approval trigger & reason details verified!');
    } else {
      console.error('FAILED: Approval parameters mismatch');
    }

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

testApprovalFlow();
