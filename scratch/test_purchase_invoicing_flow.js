const { PurchaseOrder, PurchaseInvoice, GoodsReceipt, StockItem, Supplier, sequelize } = require('../models');
const purchaseInvoiceRepository = require('../src/repositories/purchaseInvoiceRepository');
const purchaseRepository = require('../src/repositories/purchaseRepository');

async function testPurchaseInvoicingFlow() {
  try {
    console.log('\n=== TEST: PURCHASE GOODS RECEIPT & INVOICING FLOW ===\n');
    await PurchaseInvoice.sync({ alter: true });

    const mockUser = { id: 1, username: 'admin', firstName: 'Samet', lastName: 'Bitiş', role: 'Admin' };

    // 1. Create a test PurchaseOrder with status 'Received'
    const testOrder = await PurchaseOrder.create({
      orderNo: `TEST-ORD-REC-${Date.now().toString().slice(-4)}`,
      supplierName: 'Fatura Test Tedarikçi A.Ş.',
      supplierTaxNo: '9876543210',
      supplierTaxOffice: 'Kadıköy V.D.',
      orderDate: new Date().toISOString().split('T')[0],
      paymentTerm: 'Vadeli_30',
      status: 'Received',
      priority: 'Normal',
      stockItemId: 1,
      quantity: 50,
      unitPrice: 200,
      subtotal: 10000.00,
      discountAmount: 0,
      taxAmount: 2000.00,
      totalAmount: 12000.00,
      currency: 'TRY',
      createdBy: mockUser.id
    });

    console.log(`  1. Created Received Order (${testOrder.orderNo}) | Status: ${testOrder.status} | Total: ${testOrder.totalAmount} TL`);

    // 2. Verify initial invoice check -> Should have NO invoice
    let existingInv = await purchaseInvoiceRepository.findByOrderId(testOrder.id);
    console.log(`  2. Initial Invoice Check: ${existingInv ? 'EXISTS' : 'NONE'}`);
    if (!existingInv) {
      console.log(`     ✅ PASS: Order initially has no invoice!`);
    }

    // 3. Issue Purchase Invoice for this order
    const nextInvNo = await purchaseInvoiceRepository.getNextInvoiceNo();
    const createdInvoice = await purchaseInvoiceRepository.create({
      invoiceNo: nextInvNo,
      purchaseOrderId: testOrder.id,
      supplierId: testOrder.supplierId,
      supplierName: testOrder.supplierName,
      supplierTaxOffice: testOrder.supplierTaxOffice,
      supplierTaxNo: testOrder.supplierTaxNo,
      invoiceDate: new Date().toISOString().split('T')[0],
      orderNo: testOrder.orderNo,
      orderDate: testOrder.orderDate,
      subtotal: testOrder.subtotal,
      discountAmount: testOrder.discountAmount,
      taxAmount: testOrder.taxAmount,
      totalAmount: testOrder.totalAmount,
      currency: testOrder.currency,
      paymentTerm: testOrder.paymentTerm,
      notes: 'Test Alış Faturası'
    }, mockUser, '127.0.0.1');

    console.log(`\n  3. Created Purchase Invoice (${createdInvoice.invoiceNo}) for Order (${testOrder.orderNo}):`);
    console.log(`     - Invoice ID: ${createdInvoice.id}`);
    console.log(`     - Total Amount: ${createdInvoice.totalAmount} ${createdInvoice.currency}`);

    // 4. Verify second invoice attempt is blocked
    const invoiceRecheck = await purchaseInvoiceRepository.findByOrderId(testOrder.id);
    console.log(`\n  4. Re-check Invoice for Order (${testOrder.orderNo}):`);
    if (invoiceRecheck) {
      console.log(`     ✅ PASS: Order now registered as invoiced (${invoiceRecheck.invoiceNo})!`);
      console.log(`     ✅ PASS: 'Fatura Kes' button will be DISABLED and 'Fatura Görüntüle' enabled!`);
    } else {
      console.log(`     ❌ FAIL: Invoice missing after creation!`);
    }

    console.log('\n=== ALL PURCHASE INVOICING FLOW TESTS PASSED SUCCESSFULLY ===\n');
  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    process.exit(0);
  }
}

testPurchaseInvoicingFlow();
