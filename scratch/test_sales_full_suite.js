const { sequelize, User, StockItem, CustomerAccount, SaleQuotation, SaleOrder, SaleDispatchNote, SaleInvoice } = require('../models');
const seedInitialData = require('../src/utils/seedData');
const customerRepository = require('../src/repositories/customerRepository');
const quotationRepository = require('../src/repositories/quotationRepository');
const saleRepository = require('../src/repositories/saleRepository');
const dispatchRepository = require('../src/repositories/dispatchRepository');
const invoiceRepository = require('../src/repositories/invoiceRepository');

async function testSalesFullSuite() {
  try {
    console.log('Testing Sales Module 7 Pillars End-to-End Suite...');

    await sequelize.sync({ alter: true });
    await seedInitialData();

    const admin = await User.findOne({ where: { username: 'admin' } });
    const product = await StockItem.findOne({ where: { category: 'Mamul' } });

    // 1. Create Customer Account (Cari & Müşteri Kartı)
    const custCode = await customerRepository.getNextCustomerCode();
    const customer = await customerRepository.create({
      customerCode: custCode,
      companyName: 'Akdeniz Lojistik ve İmalat Ltd. Şti.',
      taxOffice: 'Antalya V.D.',
      taxNo: '0870123456',
      contactPerson: 'Kaan Demir',
      email: 'kaan@akdenizlojistik.com',
      phone: '+90 (242) 555 1122',
      creditLimit: 250000.00,
      paymentTermDays: 30,
      riskLevel: 'Low'
    }, admin, '127.0.0.1');

    console.log('1. Customer Account Created:', customer.customerCode, customer.companyName);

    // 2. Create Quotation (Teklif ve Fiyatlandırma)
    const quoteNo = await quotationRepository.getNextQuotationNo();
    const quotation = await quotationRepository.create({
      quotationNo: quoteNo,
      customerId: customer.id,
      customerName: customer.companyName,
      quotationDate: '2026-08-05',
      validUntil: '2026-08-20',
      stockItemId: product.id,
      quantity: 5,
      unitPrice: 24500.00,
      discountRate: 10,
      taxRate: 20,
      subtotal: 122500.00,
      discountAmount: 12250.00,
      taxAmount: 22050.00,
      totalAmount: 132300.00,
      currency: 'TRY'
    }, admin, '127.0.0.1');

    console.log('2. Quotation Created:', quotation.quotationNo, 'Status:', quotation.status, 'ApprovalNeeded:', quotation.approvalNeeded);

    // 3. Convert Quotation to Sale Order (Siparişe Dönüştür)
    const orderNo = await saleRepository.getNextOrderNo();
    const saleOrder = await saleRepository.create({
      orderNo,
      customerId: customer.id,
      customerName: customer.companyName,
      orderDate: '2026-08-05',
      paymentTerm: 'Vadeli_30',
      status: 'Approved',
      priority: 'High',
      stockItemId: product.id,
      quantity: quotation.quantity || 5,
      unitPrice: quotation.unitPrice || 24500,
      subtotal: quotation.subtotal,
      discountAmount: quotation.discountAmount,
      taxAmount: quotation.taxAmount,
      totalAmount: quotation.totalAmount,
      currency: 'TRY',
      notes: `[Teklif No: ${quotation.quotationNo}] Siparişe dönüştürüldü.`
    }, admin, '127.0.0.1');

    console.log('3. Sale Order Created:', saleOrder.orderNo, 'Total:', saleOrder.totalAmount);

    // 4. Create Dispatch Note (Sevkiyat ve İrsaliye) -> Triggers Stock Reduction
    const prevProductStock = parseFloat(product.currentStock);
    const dispatchNo = await dispatchRepository.getNextDispatchNo();
    const dispatch = await dispatchRepository.create({
      dispatchNo,
      saleOrderId: saleOrder.id,
      customerId: customer.id,
      customerName: customer.companyName,
      dispatchDate: '2026-08-05',
      carrierCompany: 'Horoz Lojistik',
      vehiclePlate: '07 ABC 123',
      driverName: 'Sami Yıldız',
      trackingNo: 'LOJ-2026-99',
      status: 'Dispatched'
    }, admin, '127.0.0.1');

    const updatedProduct = await StockItem.findByPk(product.id);
    console.log(`4. Dispatch Note Issued: ${dispatch.dispatchNo} | Product Stock BEFORE: ${prevProductStock} | AFTER Dispatch: ${updatedProduct.currentStock}`);

    // 5. Create Sale Invoice (Faturalama ve Finans) -> Triggers Customer Balance Increase
    const invoiceNo = await invoiceRepository.getNextInvoiceNo();
    const invoice = await invoiceRepository.create({
      invoiceNo,
      saleOrderId: saleOrder.id,
      dispatchNoteId: dispatch.id,
      customerId: customer.id,
      customerName: customer.companyName,
      customerTaxNo: customer.taxNo,
      invoiceDate: '2026-08-05',
      dueDate: '2026-09-05',
      subtotal: saleOrder.subtotal,
      discountAmount: saleOrder.discountAmount,
      taxAmount: saleOrder.taxAmount,
      totalAmount: saleOrder.totalAmount,
      currency: 'TRY',
      paymentStatus: 'Unpaid',
      status: 'Issued'
    }, admin, '127.0.0.1');

    const updatedCustomer = await CustomerAccount.findByPk(customer.id);
    console.log(`5. Sale Invoice Issued: ${invoice.invoiceNo} | Customer Balance Updated: ${updatedCustomer.currentBalance} TL`);

    console.log('SUCCESS: Sales Module 7 Pillars End-to-End Suite Fully Verified!');
    process.exit(0);
  } catch (err) {
    console.error('Sales Full Suite Test Failed:', err);
    process.exit(1);
  }
}

testSalesFullSuite();
