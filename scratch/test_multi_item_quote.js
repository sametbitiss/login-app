const { sequelize, User, StockItem, SaleQuotation } = require('../models');
const quotationRepository = require('../src/repositories/quotationRepository');

async function testMultiItemQuote() {
  try {
    console.log('Testing Multi-Item Sales Quote...');
    await sequelize.sync({ alter: true });

    const admin = await User.findOne({ where: { username: 'admin' } });
    const stockItems = await StockItem.findAll({ limit: 3 });

    if (stockItems.length === 0) {
      console.log('No stock items found.');
      process.exit(1);
    }

    const item1 = stockItems[0];
    const item2 = stockItems[1] || stockItems[0];

    const itemsPayload = [
      {
        stockItemId: item1.id,
        stockCode: item1.stockCode,
        name: item1.name,
        quantity: 2,
        unitPrice: 500.00,
        discountRate: 10,
        taxRate: 20,
        subtotal: 1000.00,
        discountAmount: 100.00,
        taxAmount: 180.00,
        totalAmount: 1080.00
      },
      {
        stockItemId: item2.id,
        stockCode: item2.stockCode,
        name: item2.name,
        quantity: 5,
        unitPrice: 200.00,
        discountRate: 5,
        taxRate: 20,
        subtotal: 1000.00,
        discountAmount: 50.00,
        taxAmount: 190.00,
        totalAmount: 1140.00
      }
    ];

    const nextQuotationNo = await quotationRepository.getNextQuotationNo();

    const quote = await quotationRepository.create({
      quotationNo: nextQuotationNo,
      customerName: 'Multi-Item Test A.Ş.',
      quotationDate: new Date().toISOString().split('T')[0],
      validUntil: '2026-09-30',
      stockItemId: item1.id,
      quantity: 2,
      unitPrice: 500.00,
      discountRate: 10,
      taxRate: 20,
      subtotal: 2000.00,
      discountAmount: 150.00,
      taxAmount: 370.00,
      totalAmount: 2220.00,
      currency: 'TRY',
      notes: 'Çoklu ürünlü teklif testi',
      itemsJson: JSON.stringify(itemsPayload)
    }, admin, '127.0.0.1');

    console.log('Created Quotation:', {
      id: quote.id,
      quotationNo: quote.quotationNo,
      totalAmount: quote.totalAmount,
      itemsJson: quote.itemsJson
    });

    const parsedItems = JSON.parse(quote.itemsJson);
    console.log(`Parsed ${parsedItems.length} items successfully!`);

    console.log('MULTI-ITEM QUOTE TEST SUCCESSFUL!');
    process.exit(0);
  } catch (err) {
    console.error('Multi-Item Quote Test Failed:', err);
    process.exit(1);
  }
}

testMultiItemQuote();
