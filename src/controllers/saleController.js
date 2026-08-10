const saleService = require('../services/saleService');
const stockService = require('../services/stockService');
const customerRepository = require('../repositories/customerRepository');
const quotationRepository = require('../repositories/quotationRepository');
const dispatchRepository = require('../repositories/dispatchRepository');
const invoiceRepository = require('../repositories/invoiceRepository');
const priceListRepository = require('../repositories/priceListRepository');
const exchangeRateRepository = require('../repositories/exchangeRateRepository');
const customerLedgerRepository = require('../repositories/customerLedgerRepository');
const asyncHandler = require('../utils/asyncHandler');
const { StockItem, SaleOrder, SaleQuotation, CustomerAccount, SaleInvoice, SaleDispatchNote, CustomerPriceList, ExchangeRate, CustomerLedger, User } = require('../../models');
const { Op, fn, col } = require('sequelize');

class SaleController {
  // 1. SATIŞ SİPARİŞLERİ
  listOrders = asyncHandler(async (req, res) => {
    const { search, status, paymentTerm } = req.query;
    const orders = await saleService.getAllOrders({ search, status, paymentTerm });
    const stats = await saleService.getStats();

    res.render('sales/list', {
      user: req.user,
      orders,
      stats,
      filterSearch: search || '',
      filterStatus: status || '',
      filterPaymentTerm: paymentTerm || ''
    });
  });

  renderAddOrder = asyncHandler(async (req, res) => {
    const nextOrderNo = await saleService.getNextOrderNo();
    const stockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } },
      order: [['name', 'ASC']]
    });
    const customers = await customerRepository.findAll({ status: 'Active' });
    const exchangeRates = await exchangeRateRepository.getLatestRates();

    res.render('sales/add', {
      user: req.user,
      error: null,
      nextOrderNo,
      stockItems,
      customers,
      exchangeRates,
      formData: {}
    });
  });

  addOrder = asyncHandler(async (req, res) => {
    try {
      const quantity = parseFloat(req.body.quantity) || 1;
      const unitPrice = parseFloat(req.body.unitPrice) || 0;
      const discountRate = parseFloat(req.body.discountRate) || 0;
      const taxRate = parseFloat(req.body.taxRate) || 20;

      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discountRate / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (taxRate / 100);
      const totalAmount = afterDiscount + taxAmount;

      let approvalNeeded = discountRate > 20 || totalAmount > 100000;
      let approvalReason = [];
      if (discountRate > 20) approvalReason.push('Yüksek İskonto Oranı (>%20)');
      if (totalAmount > 100000) approvalReason.push('Yüksek Sipariş Tutarı (>100.000 TL)');

      const customerId = req.body.customerId ? parseInt(req.body.customerId, 10) : null;
      if (customerId) {
        const cust = await CustomerAccount.findByPk(customerId);
        if (cust) {
          const newBalance = parseFloat(cust.currentBalance) + totalAmount;
          if (newBalance > parseFloat(cust.creditLimit)) {
            approvalNeeded = true;
            approvalReason.push('Müşteri Risk Limit Aşımı');
          }
        }
      }

      const data = {
        orderNo: req.body.orderNo ? req.body.orderNo.trim() : '',
        customerId,
        customerName: req.body.customerName ? req.body.customerName.trim() : '',
        customerTaxNo: req.body.customerTaxNo && req.body.customerTaxNo.trim() ? req.body.customerTaxNo.trim() : null,
        customerEmail: req.body.customerEmail && req.body.customerEmail.trim() ? req.body.customerEmail.trim() : null,
        customerPhone: req.body.customerPhone && req.body.customerPhone.trim() ? req.body.customerPhone.trim() : null,
        orderDate: req.body.orderDate || new Date().toISOString().split('T')[0],
        deliveryDate: req.body.deliveryDate || null,
        paymentTerm: req.body.paymentTerm || 'Pesin',
        status: approvalNeeded ? 'Pending_Approval' : 'Approved',
        approvalNeeded,
        approvalReason: approvalReason.join(', ') || null,
        priority: req.body.priority || 'Normal',
        stockItemId: parseInt(req.body.stockItemId, 10),
        quantity,
        unitPrice,
        discountRate,
        taxRate,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        currency: req.body.currency || 'TRY',
        shippingAddress: req.body.shippingAddress || null,
        billingAddress: req.body.billingAddress || null,
        salesRep: req.body.salesRep || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username),
        notes: req.body.notes || null
      };

      await saleService.createOrder(data, req.user, req.ip);
      res.redirect('/sales/orders');
    } catch (err) {
      const nextOrderNo = await saleService.getNextOrderNo();
      const stockItems = await StockItem.findAll({
        where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } }
      });
      const customers = await customerRepository.findAll({ status: 'Active' });
      const exchangeRates = await exchangeRateRepository.getLatestRates();

      res.render('sales/add', {
        user: req.user,
        error: err.message || 'Sipariş oluşturulurken bir hata oluştu.',
        nextOrderNo,
        stockItems,
        customers,
        exchangeRates,
        formData: req.body
      });
    }
  });

  renderEditOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await saleService.getOrderById(id);
    const stockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } },
      order: [['name', 'ASC']]
    });

    res.render('sales/edit', {
      user: req.user,
      order,
      stockItems,
      error: null
    });
  });

  editOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      const quantity = parseFloat(req.body.quantity) || 1;
      const unitPrice = parseFloat(req.body.unitPrice) || 0;
      const discountRate = parseFloat(req.body.discountRate) || 0;
      const taxRate = parseFloat(req.body.taxRate) || 20;

      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discountRate / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (taxRate / 100);
      const totalAmount = afterDiscount + taxAmount;

      await saleService.updateOrder(id, {
        customerName: req.body.customerName ? req.body.customerName.trim() : '',
        customerTaxNo: req.body.customerTaxNo || null,
        customerEmail: req.body.customerEmail || null,
        customerPhone: req.body.customerPhone || null,
        orderDate: req.body.orderDate,
        paymentTerm: req.body.paymentTerm,
        status: req.body.status,
        priority: req.body.priority,
        stockItemId: parseInt(req.body.stockItemId, 10),
        quantity,
        unitPrice,
        discountRate,
        taxRate,
        subtotal,
        discountAmount,
        taxAmount,
        totalAmount,
        currency: req.body.currency || 'TRY',
        shippingAddress: req.body.shippingAddress || null,
        billingAddress: req.body.billingAddress || null,
        notes: req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/sales/orders');
    } catch (err) {
      const order = await saleService.getOrderById(id);
      const stockItems = await StockItem.findAll({
        where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } }
      });

      res.render('sales/edit', {
        user: req.user,
        order,
        stockItems,
        error: err.message || 'Sipariş güncellenirken hata oluştu.'
      });
    }
  });

  viewOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await saleService.getOrderById(id);
    const dispatches = await SaleDispatchNote.findAll({ where: { saleOrderId: id } });
    const invoices = await SaleInvoice.findAll({ where: { saleOrderId: id } });

    res.render('sales/order_view', {
      user: req.user,
      order,
      dispatches,
      invoices
    });
  });

  // 2. TEKLİF & FİYATLANDIRMA
  listQuotations = asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    const quotations = await quotationRepository.findAll({ search, status });
    res.render('sales/quotes', {
      user: req.user,
      quotations,
      filterSearch: search || '',
      filterStatus: status || ''
    });
  });

  renderAddQuotation = asyncHandler(async (req, res) => {
    const nextQuotationNo = await quotationRepository.getNextQuotationNo();
    const stockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } },
      order: [['name', 'ASC']]
    });
    const customers = await customerRepository.findAll({ status: 'Active' });
    const exchangeRates = await exchangeRateRepository.getLatestRates();

    res.render('sales/quotes_add', {
      user: req.user,
      nextQuotationNo,
      stockItems,
      customers,
      exchangeRates,
      error: null
    });
  });

  addQuotation = asyncHandler(async (req, res) => {
    try {
      let items = [];
      if (req.body.itemsJson) {
        try {
          items = typeof req.body.itemsJson === 'string' ? JSON.parse(req.body.itemsJson) : req.body.itemsJson;
        } catch (e) {
          items = [];
        }
      }

      // Fallback if items is empty but single item form fields exist
      if (!Array.isArray(items) || items.length === 0) {
        const stockItemId = parseInt(req.body.stockItemId, 10) || null;
        const quantity = parseFloat(req.body.quantity) || 1;
        const unitPrice = parseFloat(req.body.unitPrice) || 0;
        const discountRate = parseFloat(req.body.discountRate) || 0;
        const taxRate = parseFloat(req.body.taxRate) || 20;

        const subtotal = quantity * unitPrice;
        const discountAmount = subtotal * (discountRate / 100);
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * (taxRate / 100);
        const totalAmount = afterDiscount + taxAmount;

        items = [{
          stockItemId,
          quantity,
          unitPrice,
          discountRate,
          taxRate,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount
        }];
      }

      // Calculate grand totals across all items
      let grandSubtotal = 0;
      let grandDiscountAmount = 0;
      let grandTaxAmount = 0;
      let grandTotalAmount = 0;
      let maxDiscountRate = 0;

      const processedItems = [];
      for (const item of items) {
        const q = parseFloat(item.quantity) || 0;
        const p = parseFloat(item.unitPrice) || 0;
        const d = parseFloat(item.discountRate) || 0;
        const t = item.taxRate !== undefined ? parseFloat(item.taxRate) : 20;

        const sub = q * p;
        const disc = sub * (d / 100);
        const afterDisc = sub - disc;
        const tax = afterDisc * (t / 100);
        const tot = afterDisc + tax;

        grandSubtotal += sub;
        grandDiscountAmount += disc;
        grandTaxAmount += tax;
        grandTotalAmount += tot;
        if (d > maxDiscountRate) maxDiscountRate = d;

        let itemName = item.name || '';
        let stockCode = item.stockCode || '';
        if (item.stockItemId) {
          const st = await StockItem.findByPk(item.stockItemId);
          if (st) {
            itemName = st.name;
            stockCode = st.stockCode;
          }
        }

        processedItems.push({
          stockItemId: item.stockItemId ? parseInt(item.stockItemId, 10) : null,
          stockCode,
          name: itemName,
          quantity: q,
          unitPrice: p,
          discountRate: d,
          taxRate: t,
          subtotal: sub,
          discountAmount: disc,
          taxAmount: tax,
          totalAmount: tot
        });
      }

      const primaryItem = processedItems[0] || {};

      await quotationRepository.create({
        quotationNo: req.body.quotationNo,
        customerId: req.body.customerId ? parseInt(req.body.customerId, 10) : null,
        customerName: req.body.customerName,
        quotationDate: req.body.quotationDate || new Date().toISOString().split('T')[0],
        validUntil: req.body.validUntil,
        stockItemId: primaryItem.stockItemId || null,
        quantity: primaryItem.quantity || 1,
        unitPrice: primaryItem.unitPrice || 0,
        discountRate: maxDiscountRate,
        taxRate: primaryItem.taxRate !== undefined ? primaryItem.taxRate : 20,
        subtotal: grandSubtotal,
        discountAmount: grandDiscountAmount,
        taxAmount: grandTaxAmount,
        totalAmount: grandTotalAmount,
        currency: req.body.currency || 'TRY',
        notes: req.body.notes || null,
        itemsJson: JSON.stringify(processedItems)
      }, req.user, req.ip);

      res.redirect('/sales/quotes');
    } catch (err) {
      const nextQuotationNo = await quotationRepository.getNextQuotationNo();
      const stockItems = await StockItem.findAll({ where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } } });
      const customers = await customerRepository.findAll({ status: 'Active' });
      const exchangeRates = await exchangeRateRepository.getLatestRates();

      res.render('sales/quotes_add', {
        user: req.user,
        nextQuotationNo,
        stockItems,
        customers,
        exchangeRates,
        error: err.message || 'Teklif oluşturulurken hata oluştu.'
      });
    }
  });

  viewQuotation = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const quote = await quotationRepository.findById(id);
    if (!quote) {
      return res.status(404).render('error', { user: req.user, statusCode: 404, message: 'Teklif bulunamadı.', details: [] });
    }

    let parsedItems = [];
    if (quote.itemsJson) {
      try {
        parsedItems = JSON.parse(quote.itemsJson);
      } catch (e) {
        parsedItems = [];
      }
    }

    if (!parsedItems || parsedItems.length === 0) {
      parsedItems = [{
        stockItemId: quote.stockItemId,
        stockCode: quote.stockItem ? quote.stockItem.stockCode : '-',
        name: quote.stockItem ? quote.stockItem.name : 'Ürün Kalemi',
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
        discountRate: quote.discountRate,
        taxRate: quote.taxRate,
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        taxAmount: quote.taxAmount,
        totalAmount: quote.totalAmount
      }];
    }

    res.render('sales/quote_view', {
      user: req.user,
      quote,
      items: parsedItems
    });
  });

  convertQuotationToOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const quote = await quotationRepository.findById(id);

    if (quote) {
      const nextOrderNo = await saleService.getNextOrderNo();
      await saleService.createOrder({
        orderNo: nextOrderNo,
        customerId: quote.customerId,
        customerName: quote.customerName,
        orderDate: new Date().toISOString().split('T')[0],
        paymentTerm: 'Vadeli_30',
        status: 'Approved',
        priority: 'Normal',
        stockItemId: quote.stockItemId,
        quantity: quote.quantity,
        unitPrice: quote.unitPrice,
        discountRate: quote.discountRate,
        taxRate: quote.taxRate,
        subtotal: quote.subtotal,
        discountAmount: quote.discountAmount,
        taxAmount: quote.taxAmount,
        totalAmount: quote.totalAmount,
        currency: quote.currency,
        salesRep: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username,
        notes: `[Teklif No: ${quote.quotationNo}] Teklif onaylanarak siparişe dönüştürüldü.`
      }, req.user, req.ip);

      await quotationRepository.updateStatus(id, 'Converted', 'Siparişe dönüştürüldü', req.user, req.ip);
    }

    res.redirect('/sales/orders');
  });

  // 2b. MÜŞTERİ ÖZEL FİYAT LİSTELERİ & DÖVİZ KURLARI
  listPriceLists = asyncHandler(async (req, res) => {
    const priceLists = await priceListRepository.findAll();
    const customers = await customerRepository.findAll({ status: 'Active' });
    const stockItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });

    res.render('sales/price_lists', {
      user: req.user,
      priceLists,
      customers,
      stockItems,
      error: null
    });
  });

  addPriceList = asyncHandler(async (req, res) => {
    try {
      await priceListRepository.create({
        listName: req.body.listName || 'Özel Fiyat Tanımı',
        customerId: req.body.customerId ? parseInt(req.body.customerId, 10) : null,
        stockItemId: parseInt(req.body.stockItemId, 10),
        specialPrice: parseFloat(req.body.specialPrice) || 0,
        customDiscountRate: parseFloat(req.body.customDiscountRate) || 0,
        currency: req.body.currency || 'TRY',
        validFrom: req.body.validFrom || null,
        validUntil: req.body.validUntil || null,
        notes: req.body.notes || null,
        status: 'Active'
      }, req.user);

      res.redirect('/sales/price-lists');
    } catch (err) {
      const priceLists = await priceListRepository.findAll();
      const customers = await customerRepository.findAll({ status: 'Active' });
      const stockItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });

      res.render('sales/price_lists', {
        user: req.user,
        priceLists,
        customers,
        stockItems,
        error: err.message || 'Fiyat listesi kaydı oluşturulurken hata oluştu.'
      });
    }
  });



  // 3. CARİ VE MÜŞTERİ KARTLARI
  listCustomers = asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    const customers = await customerRepository.findAll({ search, status });
    res.render('sales/customers', {
      user: req.user,
      customers,
      filterSearch: search || '',
      filterStatus: status || ''
    });
  });

  renderAddCustomer = asyncHandler(async (req, res) => {
    const nextCode = await customerRepository.getNextCustomerCode();
    res.render('sales/customers_add', {
      user: req.user,
      nextCode,
      error: null
    });
  });

  addCustomer = asyncHandler(async (req, res) => {
    try {
      await customerRepository.create({
        customerCode: req.body.customerCode,
        companyName: req.body.companyName,
        taxOffice: req.body.taxOffice || null,
        taxNo: req.body.taxNo || null,
        contactPerson: req.body.contactPerson || null,
        email: req.body.email || null,
        phone: req.body.phone || null,
        address: req.body.address || null,
        city: req.body.city || null,
        creditLimit: parseFloat(req.body.creditLimit) || 100000.00,
        paymentTermDays: parseInt(req.body.paymentTermDays, 10) || 30,
        riskLevel: req.body.riskLevel || 'Low',
        status: 'Active',
        notes: req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/sales/customers');
    } catch (err) {
      const nextCode = await customerRepository.getNextCustomerCode();
      res.render('sales/customers_add', {
        user: req.user,
        nextCode,
        error: err.message || 'Müşteri kartı eklenirken hata oluştu.'
      });
    }
  });

  viewCustomer = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const customer = await customerRepository.findById(id);
    if (!customer) return res.redirect('/sales/customers');

    const ledgerEntries = await customerLedgerRepository.findByCustomerId(id);
    const orders = await SaleOrder.findAll({ where: { customerId: id }, order: [['createdAt', 'DESC']] });
    const quotes = await SaleQuotation.findAll({ where: { customerId: id }, order: [['createdAt', 'DESC']] });
    const invoices = await SaleInvoice.findAll({ where: { customerId: id }, order: [['createdAt', 'DESC']] });

    res.render('sales/customer_view', {
      user: req.user,
      customer,
      ledgerEntries,
      orders,
      quotes,
      invoices,
      error: null
    });
  });

  addCustomerLedgerEntry = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      const type = req.body.type;
      const amount = parseFloat(req.body.amount) || 0;

      await customerLedgerRepository.addEntry({
        customerId: parseInt(id, 10),
        transactionDate: req.body.transactionDate || new Date().toISOString().split('T')[0],
        documentNo: req.body.documentNo || `ISL-${Date.now().toString().slice(-6)}`,
        description: req.body.description || 'Tahsilat / Manuel Cari İşlem',
        debitAmount: type === 'Debit' ? amount : 0,
        creditAmount: type === 'Credit' ? amount : 0,
        currency: req.body.currency || 'TRY'
      }, req.user);

      res.redirect(`/sales/customers/${id}`);
    } catch (err) {
      res.redirect(`/sales/customers/${id}`);
    }
  });

  // 4. SEVKİYAT VE İRSALİYELER
  listDispatches = asyncHandler(async (req, res) => {
    const dispatches = await dispatchRepository.findAll();
    const openOrders = await SaleOrder.findAll({
      where: { status: { [Op.in]: ['Approved', 'Preparing'] } },
      include: [{ model: StockItem, as: 'stockItem' }]
    });
    const nextDispatchNo = await dispatchRepository.getNextDispatchNo();

    res.render('sales/dispatches', {
      user: req.user,
      dispatches,
      openOrders,
      nextDispatchNo
    });
  });

  addDispatch = asyncHandler(async (req, res) => {
    const { saleOrderId, carrierCompany, vehiclePlate, driverName, trackingNo, notes } = req.body;
    const order = await SaleOrder.findByPk(saleOrderId);

    if (order) {
      const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
      await dispatchRepository.create({
        dispatchNo: nextDispatchNo,
        saleOrderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        dispatchDate: new Date().toISOString().split('T')[0],
        carrierCompany: carrierCompany || null,
        vehiclePlate: vehiclePlate || null,
        driverName: driverName || null,
        trackingNo: trackingNo || null,
        shippingAddress: order.shippingAddress || null,
        status: 'Dispatched',
        notes: notes || null
      }, req.user, req.ip);
    }

    res.redirect('/sales/dispatches');
  });

  viewDispatch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const dispatch = await dispatchRepository.findById(id);
    res.render('sales/dispatch_view', {
      user: req.user,
      dispatch
    });
  });

  // 5. FATURALANDIRMA
  listInvoices = asyncHandler(async (req, res) => {
    const invoices = await invoiceRepository.findAll();
    const completedOrders = await SaleOrder.findAll({
      where: { status: 'Completed' },
      include: [{ model: StockItem, as: 'stockItem' }]
    });

    res.render('sales/invoices', {
      user: req.user,
      invoices,
      completedOrders
    });
  });

  createInvoiceFromOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await SaleOrder.findByPk(id);

    if (order) {
      const nextInvoiceNo = await invoiceRepository.getNextInvoiceNo();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const invoice = await invoiceRepository.create({
        invoiceNo: nextInvoiceNo,
        saleOrderId: order.id,
        customerId: order.customerId,
        customerName: order.customerName,
        customerTaxNo: order.customerTaxNo,
        invoiceDate: new Date().toISOString().split('T')[0],
        dueDate: dueDate.toISOString().split('T')[0],
        subtotal: order.subtotal,
        discountAmount: order.discountAmount,
        taxAmount: order.taxAmount,
        totalAmount: order.totalAmount,
        currency: order.currency,
        paymentStatus: 'Unpaid',
        status: 'Issued',
        notes: `[Sipariş No: ${order.orderNo}] numaralı satış siparişi faturaya dönüştürüldü.`
      }, req.user, req.ip);

      if (order.customerId) {
        await customerLedgerRepository.addEntry({
          customerId: order.customerId,
          transactionDate: invoice.invoiceDate,
          documentNo: invoice.invoiceNo,
          description: `[Satış Faturası] ${invoice.invoiceNo} no'lu fatura kaydı`,
          debitAmount: invoice.totalAmount,
          creditAmount: 0,
          currency: invoice.currency
        }, req.user);
      }
    }

    res.redirect('/sales/invoices');
  });

  viewInvoice = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const invoice = await invoiceRepository.findById(id);
    res.render('sales/invoice_view', {
      user: req.user,
      invoice
    });
  });

  // 6. ONAY MEKANİZMALARI
  listApprovals = asyncHandler(async (req, res) => {
    const pendingQuotes = await SaleQuotation.findAll({
      where: { status: 'Pending_Approval' },
      include: [{ model: StockItem, as: 'stockItem' }]
    });
    const pendingOrders = await SaleOrder.findAll({
      where: { status: 'Pending_Approval' },
      include: [{ model: StockItem, as: 'stockItem' }]
    });

    res.render('sales/approvals', {
      user: req.user,
      pendingQuotes,
      pendingOrders
    });
  });

  approveOrderOrQuote = asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { action, managerNotes } = req.body;

    if (type === 'quote') {
      const status = action === 'approve' ? 'Approved' : 'Rejected';
      await quotationRepository.updateStatus(id, status, managerNotes, req.user, req.ip);
    } else if (type === 'order') {
      const status = action === 'approve' ? 'Approved' : 'Cancelled';
      await saleService.updateOrder(id, { status, managerNotes }, req.user, req.ip);
    }

    res.redirect('/sales/approvals');
  });

  // 7. SATIŞ ANALİTİĞİ DASHBOARD
  showAnalytics = asyncHandler(async (req, res) => {
    let totalOrders = 0, completedOrders = 0, pendingOrders = 0, totalRevenue = 0;
    try {
      totalOrders = (await SaleOrder.count()) || 0;
      completedOrders = (await SaleOrder.count({ where: { status: 'Completed' } })) || 0;
      pendingOrders = (await SaleOrder.count({ where: { status: 'Pending_Approval' } })) || 0;
      const revenueResult = await SaleOrder.sum('totalAmount', { where: { status: { [Op.ne]: 'Cancelled' } } });
      totalRevenue = parseFloat(revenueResult || 0);
    } catch (e) {
      console.error('Analytics count error:', e);
    }

    let salesRepData = [];
    try {
      salesRepData = await SaleOrder.findAll({
        attributes: [
          'salesRep',
          [fn('SUM', col('totalAmount')), 'totalRevenue'],
          [fn('COUNT', col('id')), 'orderCount']
        ],
        where: { status: { [Op.ne]: 'Cancelled' } },
        group: ['salesRep'],
        raw: true
      });
    } catch (e) {
      console.error('Analytics salesRepData error:', e);
    }

    let ordersWithItems = [];
    try {
      ordersWithItems = await SaleOrder.findAll({
        where: { status: { [Op.ne]: 'Cancelled' } },
        include: [{ model: StockItem, as: 'stockItem' }]
      });
    } catch (e) {
      console.error('Analytics ordersWithItems error:', e);
    }

    let totalCost = 0;
    const productStatsMap = {};

    ordersWithItems.forEach(o => {
      const purchasePrice = o.stockItem ? parseFloat(o.stockItem.purchasePrice || 0) : 0;
      const qty = parseFloat(o.quantity || 0);
      const orderCost = qty * purchasePrice;
      totalCost += orderCost;

      const itemName = o.stockItem ? o.stockItem.name : 'Diğer Ürün';
      if (!productStatsMap[itemName]) {
        productStatsMap[itemName] = { quantity: 0, revenue: 0 };
      }
      productStatsMap[itemName].quantity += qty;
      productStatsMap[itemName].revenue += parseFloat(o.totalAmount || 0);
    });

    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const topProducts = Object.keys(productStatsMap)
      .map(name => ({ name, ...productStatsMap[name] }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    let recentOrders = [];
    try {
      recentOrders = await SaleOrder.findAll({
        include: [{ model: StockItem, as: 'stockItem' }],
        limit: 10,
        order: [['createdAt', 'DESC']]
      });
    } catch (e) {
      console.error('Analytics recentOrders error:', e);
    }

    res.render('sales/analytics', {
      user: req.user,
      totalOrders,
      completedOrders,
      pendingOrders,
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      salesRepData: salesRepData || [],
      topProducts: topProducts || [],
      recentOrders: recentOrders || []
    });
  });

  // 8. DYNAMIC API LOOKUPS
  apiGetCustomerPrice = asyncHandler(async (req, res) => {
    const { customerId, stockItemId } = req.query;
    let specialPrice = null;
    let customDiscountRate = 0;
    let currency = 'TRY';

    if (customerId && stockItemId) {
      const pList = await priceListRepository.findCustomerSpecialPrice(customerId, stockItemId);
      if (pList) {
        specialPrice = pList.specialPrice;
        customDiscountRate = pList.customDiscountRate;
        currency = pList.currency;
      }
    }

    const stockItem = stockItemId ? await StockItem.findByPk(stockItemId) : null;

    res.json({
      success: true,
      hasSpecialPrice: specialPrice !== null,
      specialPrice: specialPrice !== null ? parseFloat(specialPrice) : (stockItem ? parseFloat(stockItem.salePrice) : 0),
      standardPrice: stockItem ? parseFloat(stockItem.salePrice) : 0,
      customDiscountRate: parseFloat(customDiscountRate),
      currency: currency || 'TRY'
    });
  });

  apiGetStockInfo = asyncHandler(async (req, res) => {
    const { stockItemId } = req.params;
    const item = await StockItem.findByPk(stockItemId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Stok kartı bulunamadı.' });
    }

    res.json({
      success: true,
      id: item.id,
      stockCode: item.stockCode,
      name: item.name,
      unit: item.unit,
      currentStock: parseFloat(item.currentStock),
      minStockLevel: parseFloat(item.minStockLevel || 0),
      salePrice: parseFloat(item.salePrice),
      vatRate: parseFloat(item.vatRate || 20),
      isLowStock: parseFloat(item.currentStock) <= parseFloat(item.minStockLevel || 0)
    });
  });
}

module.exports = new SaleController();
