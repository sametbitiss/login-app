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
      const safeInt = (val) => {
        if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return null;
        const n = parseInt(val, 10);
        return Number.isNaN(n) ? null : n;
      };
      const safeFloat = (val, defaultVal = 0) => {
        if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return defaultVal;
        const n = parseFloat(val);
        return Number.isNaN(n) ? defaultVal : n;
      };

      let items = [];
      if (req.body.itemsJson) {
        try {
          items = typeof req.body.itemsJson === 'string' ? JSON.parse(req.body.itemsJson) : req.body.itemsJson;
        } catch (e) {
          items = [];
        }
      }

      if (!Array.isArray(items) || items.length === 0) {
        const stockItemId = safeInt(req.body.stockItemId);
        const quantity = safeFloat(req.body.quantity, 1);
        const unitPrice = safeFloat(req.body.unitPrice, 0);
        const discountRate = safeFloat(req.body.discountRate, 0);
        const taxRate = safeFloat(req.body.taxRate, 20);

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

      let grandSubtotal = 0;
      let grandDiscountAmount = 0;
      let grandTaxAmount = 0;
      let grandTotalAmount = 0;
      let maxDiscountRate = 0;
      const processedItems = [];

      for (const item of items) {
        const qty = safeFloat(item.quantity, 1);
        const price = safeFloat(item.unitPrice, 0);
        const disc = safeFloat(item.discountRate, 0);
        const tax = safeFloat(item.taxRate, 20);

        const sub = qty * price;
        const discAmt = sub * (disc / 100);
        const afterDisc = sub - discAmt;
        const taxAmt = afterDisc * (tax / 100);
        const tot = afterDisc + taxAmt;

        grandSubtotal += sub;
        grandDiscountAmount += discAmt;
        grandTaxAmount += taxAmt;
        grandTotalAmount += tot;

        if (disc > maxDiscountRate) maxDiscountRate = disc;

        const itemId = safeInt(item.stockItemId);
        let itemName = item.name || 'Ürün Kalemi';
        let stockCode = item.stockCode || '';
        if (itemId && itemId > 0) {
          const st = await StockItem.findByPk(itemId);
          if (st) {
            itemName = st.name;
            stockCode = st.stockCode;
          }
        }

        processedItems.push({
          stockItemId: itemId && itemId > 0 ? itemId : null,
          stockCode,
          name: itemName,
          quantity: qty,
          unitPrice: price,
          discountRate: disc,
          taxRate: tax,
          subtotal: sub,
          discountAmount: discAmt,
          taxAmount: taxAmt,
          totalAmount: tot
        });
      }

      const primaryItem = processedItems[0] || {};
      let primaryStockItemId = safeInt(primaryItem.stockItemId);
      if (!primaryStockItemId || primaryStockItemId <= 0) {
        const defaultStock = await StockItem.findOne({ where: { status: 'Active' } });
        primaryStockItemId = defaultStock ? defaultStock.id : 1;
      }
      const customerId = safeInt(req.body.customerId);

      // Customer score & risk validation
      if (customerId) {
        const cust = await customerRepository.findById(customerId);
        if (cust) {
          const score = cust.customerScore !== undefined ? cust.customerScore : 85;
          const isBlocked = score < 50 || cust.riskLevel === 'High' || cust.riskLevel === 'Blocked' || cust.riskLevel === 'Critical';
          if (isBlocked) {
            const nextOrderNo = await saleService.getNextOrderNo();
            const stockItems = await StockItem.findAll({ where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } }, order: [['name', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            return res.render('sales/add', {
              user: req.user,
              nextOrderNo,
              stockItems,
              customers,
              exchangeRates,
              formData: req.body,
              error: `⚠️ Seçilen müşterinin skoru yetersizdir (Puan: ${score}/100, Risk: ${cust.riskLevel}). Yüksek riskli müşterilere yeni sipariş oluşturulamaz!`
            });
          }

          // Credit limit risk validation (creditLimit - currentBalance)
          const creditLimit = parseFloat(cust.creditLimit) || 0;
          const currentBalance = parseFloat(cust.currentBalance) || 0;
          const availableCredit = creditLimit - currentBalance;

          if (creditLimit > 0 && grandTotalAmount > availableCredit) {
            const nextOrderNo = await saleService.getNextOrderNo();
            const stockItems = await StockItem.findAll({ where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } }, order: [['name', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            return res.render('sales/add', {
              user: req.user,
              nextOrderNo,
              stockItems,
              customers,
              exchangeRates,
              formData: req.body,
              error: `⚠️ Risk Limiti Aşımı! Müşterinin kullanılabilir risk limiti (${availableCredit.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL), sipariş tutarından (${grandTotalAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL) azdır. Risk limiti aşılacağı için bu sipariş oluşturulamaz! (Toplam Limit: ${creditLimit.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL, Borç Bakiyesi: ${currentBalance.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL)`
            });
          }
        }
      }

      const customerName = (req.body.customerName && req.body.customerName.trim() !== '') ? req.body.customerName.trim() : 'Genel Müşteri';
      let rawCurrency = req.body.currency || 'TRY';
      let currency = 'TRY';
      if (rawCurrency.includes('USD')) currency = 'USD';
      else if (rawCurrency.includes('EUR')) currency = 'EUR';

      // Check item discounts (>20%) and total amount (>100k TL)
      const highDiscountReasons = [];
      for (const item of processedItems) {
        if (item.discountRate > 20) {
          const discountVal = parseFloat(item.discountRate).toLocaleString('tr-TR');
          highDiscountReasons.push(`${item.name || 'Ürün'} (%${discountVal} iskonto)`);
        }
      }

      let approvalNeeded = false;
      let approvalReason = null;

      if (highDiscountReasons.length > 0 && grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek İskonto: ${highDiscountReasons.join(', ')} ve Yüksek Tutar (${grandTotalAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})} ${currency} > 100.000 TL)`;
      } else if (highDiscountReasons.length > 0) {
        approvalNeeded = true;
        approvalReason = `Yüksek Ürün İskontosu: ${highDiscountReasons.join(', ')} (Yönetsel onay sınırı: %20)`;
      } else if (grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek Sipariş Tutarı (${grandTotalAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})} ${currency} > 100.000 TL)`;
      }

      const status = approvalNeeded ? 'Pending_Approval' : 'Approved';
      const nextOrderNo = await saleService.getNextOrderNo();
      let rawPaymentTerm = req.body.paymentTerm || 'Pesin';
      let paymentTerm = 'Pesin';
      if (rawPaymentTerm.includes('30') || rawPaymentTerm === 'Vadeli_30') paymentTerm = 'Vadeli_30';
      else if (rawPaymentTerm.includes('60') || rawPaymentTerm === 'Vadeli_60') paymentTerm = 'Vadeli_60';
      else if (rawPaymentTerm.includes('90') || rawPaymentTerm === 'Vadeli_90') paymentTerm = 'Vadeli_90';
      else if (rawPaymentTerm.toLowerCase().includes('kredi') || rawPaymentTerm === 'Kredi_Karti') paymentTerm = 'Kredi_Karti';
      else paymentTerm = 'Pesin';

      await saleService.createOrder({
        orderNo: nextOrderNo,
        customerId,
        customerName,
        customerTaxNo: req.body.customerTaxNo ? req.body.customerTaxNo.trim() : null,
        customerPhone: req.body.customerPhone ? req.body.customerPhone.trim() : null,
        orderDate: new Date().toISOString().split('T')[0],
        deliveryDate: req.body.deliveryDate || null,
        paymentTerm,
        status,
        approvalNeeded,
        approvalReason,
        priority: req.body.priority || 'Normal',
        stockItemId: primaryStockItemId,
        quantity: safeFloat(primaryItem.quantity, 1),
        unitPrice: safeFloat(primaryItem.unitPrice, 0),
        discountRate: maxDiscountRate,
        taxRate: safeFloat(primaryItem.taxRate, 20),
        subtotal: grandSubtotal,
        discountAmount: grandDiscountAmount,
        taxAmount: grandTaxAmount,
        totalAmount: grandTotalAmount,
        currency,
        itemsJson: JSON.stringify(processedItems),
        shippingAddress: req.body.shippingAddress || null,
        billingAddress: req.body.billingAddress || null,
        salesRep: req.body.salesRep || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username),
        notes: req.body.notes || null
      }, req.user, req.ip);

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
      const safeInt = (val) => {
        if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return null;
        const n = parseInt(val, 10);
        return Number.isNaN(n) ? null : n;
      };
      const safeFloat = (val, defaultVal = 0) => {
        if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return defaultVal;
        const n = parseFloat(val);
        return Number.isNaN(n) ? defaultVal : n;
      };

      const quantity = safeFloat(req.body.quantity, 1);
      const unitPrice = safeFloat(req.body.unitPrice, 0);
      const discountRate = safeFloat(req.body.discountRate, 0);
      const taxRate = safeFloat(req.body.taxRate, 20);

      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discountRate / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (taxRate / 100);
      const totalAmount = afterDiscount + taxAmount;

      let stockItemId = safeInt(req.body.stockItemId);
      if (!stockItemId || stockItemId <= 0) {
        const defaultStock = await StockItem.findOne({ where: { status: 'Active' } });
        stockItemId = defaultStock ? defaultStock.id : 1;
      }

      await saleService.updateOrder(id, {
        customerName: req.body.customerName ? req.body.customerName.trim() : '',
        customerTaxNo: req.body.customerTaxNo || null,
        customerEmail: req.body.customerEmail || null,
        customerPhone: req.body.customerPhone || null,
        orderDate: req.body.orderDate,
        paymentTerm: req.body.paymentTerm,
        status: req.body.status,
        priority: req.body.priority,
        stockItemId,
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
      const safeInt = (val) => {
        if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return null;
        const n = parseInt(val, 10);
        return Number.isNaN(n) ? null : n;
      };
      const safeFloat = (val, defaultVal = 0) => {
        if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return defaultVal;
        const n = parseFloat(val);
        return Number.isNaN(n) ? defaultVal : n;
      };

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
        const stockItemId = safeInt(req.body.stockItemId);
        const quantity = safeFloat(req.body.quantity, 1);
        const unitPrice = safeFloat(req.body.unitPrice, 0);
        const discountRate = safeFloat(req.body.discountRate, 0);
        const taxRate = safeFloat(req.body.taxRate, 20);

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
        const itemId = safeInt(item.stockItemId);
        const q = safeFloat(item.quantity, 1);
        const p = safeFloat(item.unitPrice, 0);
        const d = safeFloat(item.discountRate, 0);
        const t = safeFloat(item.taxRate, 20);

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
        if (itemId) {
          const st = await StockItem.findByPk(itemId);
          if (st) {
            itemName = st.name;
            stockCode = st.stockCode;
          }
        }

        processedItems.push({
          stockItemId: itemId,
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
      let primaryStockItemId = safeInt(primaryItem.stockItemId);
      if (!primaryStockItemId || primaryStockItemId <= 0) {
        const defaultStock = await StockItem.findOne({ where: { status: 'Active' } });
        primaryStockItemId = defaultStock ? defaultStock.id : 1;
      }
      const customerId = safeInt(req.body.customerId);

      // Customer score & risk validation
      if (customerId) {
        const cust = await customerRepository.findById(customerId);
        if (cust) {
          const score = cust.customerScore !== undefined ? cust.customerScore : 85;
          const isBlocked = score < 50 || cust.riskLevel === 'High' || cust.riskLevel === 'Blocked' || cust.riskLevel === 'Critical';
          if (isBlocked) {
            const nextQuotationNo = await quotationRepository.getNextQuotationNo();
            const stockItems = await StockItem.findAll({ where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } }, order: [['name', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            return res.render('sales/quotes_add', {
              user: req.user,
              nextQuotationNo,
              stockItems,
              customers,
              exchangeRates,
              formData: req.body,
              error: `⚠️ Seçilen müşterinin skoru yetersizdir (Puan: ${score}/100, Risk: ${cust.riskLevel}). Yüksek riskli müşterilere yeni teklif hazırlanamaz!`
            });
          }

          // Credit limit risk validation (creditLimit - currentBalance)
          const creditLimit = parseFloat(cust.creditLimit) || 0;
          const currentBalance = parseFloat(cust.currentBalance) || 0;
          const availableCredit = creditLimit - currentBalance;

          if (creditLimit > 0 && grandTotalAmount > availableCredit) {
            const nextQuotationNo = await quotationRepository.getNextQuotationNo();
            const stockItems = await StockItem.findAll({ where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal'] } }, order: [['name', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            return res.render('sales/quotes_add', {
              user: req.user,
              nextQuotationNo,
              stockItems,
              customers,
              exchangeRates,
              formData: req.body,
              error: `⚠️ Risk Limiti Aşımı! Müşterinin kullanılabilir risk limiti (${availableCredit.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL), teklif tutarından (${grandTotalAmount.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL) azdır. Risk limiti aşılacağı için bu teklif oluşturulamaz! (Toplam Limit: ${creditLimit.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL, Borç Bakiyesi: ${currentBalance.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL)`
            });
          }
        }
      }

      // Ensure validUntil is never empty
      const future = new Date();
      future.setDate(future.getDate() + 15);
      const defaultValidUntil = future.toISOString().split('T')[0];
      const validUntil = (req.body.validUntil && req.body.validUntil.trim() !== '') ? req.body.validUntil.trim() : defaultValidUntil;

      // Customer name fallback
      const customerName = (req.body.customerName && req.body.customerName.trim() !== '') ? req.body.customerName.trim() : 'Genel Müşteri';

      // Currency code normalization
      let rawCurrency = req.body.currency || 'TRY';
      let currency = 'TRY';
      if (rawCurrency.includes('USD')) currency = 'USD';
      else if (rawCurrency.includes('EUR')) currency = 'EUR';

      // Check individual item discounts (>20%) and total amount (>100k)
      const highDiscountReasons = [];
      for (const item of processedItems) {
        if (item.discountRate > 20) {
          const discountVal = parseFloat(item.discountRate).toLocaleString('tr-TR');
          highDiscountReasons.push(`${item.name || 'Ürün'} (%${discountVal} iskonto)`);
        }
      }

      let approvalNeeded = false;
      let approvalReason = null;

      if (highDiscountReasons.length > 0 && grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek İskonto: ${highDiscountReasons.join(', ')} ve Yüksek Tutar (${grandTotalAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})} ${currency} > 100.000 TL)`;
      } else if (highDiscountReasons.length > 0) {
        approvalNeeded = true;
        approvalReason = `Yüksek Ürün İskontosu: ${highDiscountReasons.join(', ')} (Yönetsel onay sınırı: %20)`;
      } else if (grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek Teklif Tutarı (${grandTotalAmount.toLocaleString('tr-TR', {minimumFractionDigits:2})} ${currency} > 100.000 TL)`;
      }

      await quotationRepository.create({
        quotationNo: req.body.quotationNo,
        customerId: customerId,
        customerName: customerName,
        quotationDate: req.body.quotationDate || new Date().toISOString().split('T')[0],
        validUntil: validUntil,
        stockItemId: primaryStockItemId,
        quantity: safeFloat(primaryItem.quantity, 1),
        unitPrice: safeFloat(primaryItem.unitPrice, 0),
        discountRate: maxDiscountRate,
        taxRate: safeFloat(primaryItem.taxRate, 20),
        subtotal: grandSubtotal,
        discountAmount: grandDiscountAmount,
        taxAmount: grandTaxAmount,
        totalAmount: grandTotalAmount,
        currency: currency,
        approvalNeeded: approvalNeeded,
        approvalReason: approvalReason,
        status: approvalNeeded ? 'Pending_Approval' : 'Approved',
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

    if (!quote) {
      return res.redirect('/sales/quotes');
    }

    if (quote.status !== 'Approved') {
      return res.render('error', {
        message: 'Bu teklif yönetsel onay beklemektedir veya onaylanmamıştır. Yönetsel Onaylar ekranından onay verilmeden siparişe dönüştürülemez.',
        error: { status: 403 }
      });
    }

    // Customer score & risk check on conversion
    if (quote.customerId) {
      const cust = await customerRepository.findById(quote.customerId);
      if (cust) {
        const score = cust.customerScore !== undefined ? cust.customerScore : 85;
        const isBlocked = score < 50 || cust.riskLevel === 'High' || cust.riskLevel === 'Blocked' || cust.riskLevel === 'Critical';
        if (isBlocked) {
          return res.render('error', {
            message: `⚠️ Müşterinin skoru yetersizdir (Puan: ${score}/100, Risk: ${cust.riskLevel}). Yüksek riskli müşterilerin teklifi siparişe dönüştürülemez!`,
            error: { status: 403 }
          });
        }

        const creditLimit = parseFloat(cust.creditLimit) || 0;
        const currentBalance = parseFloat(cust.currentBalance) || 0;
        const availableCredit = creditLimit - currentBalance;
        const quoteTotal = parseFloat(quote.totalAmount) || 0;

        if (creditLimit > 0 && quoteTotal > availableCredit) {
          return res.render('error', {
            message: `⚠️ Risk Limiti Aşımı! Müşterinin kullanılabilir risk limiti (${availableCredit.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL), siparişe dönüştürülmek istenen teklif tutarından (${quoteTotal.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL) azdır. Risk limiti aşılacağı için bu teklif siparişe dönüştürülemez! (Toplam Limit: ${creditLimit.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL, Güncel Borç: ${currentBalance.toLocaleString('tr-TR', {minimumFractionDigits: 2})} TL)`,
            error: { status: 403 }
          });
        }
      }
    }

    const nextOrderNo = await saleService.getNextOrderNo();
    await saleService.createOrder({
      orderNo: nextOrderNo,
      customerId: quote.customerId,
      customerName: quote.customerName,
      orderDate: new Date().toISOString().split('T')[0],
      paymentTerm: 'Vadeli_30',
      status: 'Preparing',
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
      itemsJson: quote.itemsJson,
      salesRep: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username,
      notes: `[Teklif No: ${quote.quotationNo}] Teklif onaylanarak siparişe dönüştürüldü.`
    }, req.user, req.ip);

    await quotationRepository.updateStatus(id, 'Converted', 'Siparişe dönüştürüldü', req.user, req.ip);
    res.redirect('/sales/orders');
  });

  // 2b. MÜŞTERİ ÖZEL FİYAT LİSTELERİ & DÖVİZ KURLARI
  listPriceLists = asyncHandler(async (req, res) => {
    const rawPriceLists = await priceListRepository.findAll();
    const customers = await customerRepository.findAll({ status: 'Active' });
    const stockItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });

    // Group price lists by customerId
    const groupsMap = new Map();

    rawPriceLists.forEach(item => {
      const custId = item.customerId || 0;
      if (!groupsMap.has(custId)) {
        groupsMap.set(custId, {
          customerId: item.customerId,
          customerName: item.customer ? item.customer.companyName : 'Tüm Müşteriler (Genel İskonto)',
          customerCode: item.customer ? item.customer.customerCode : 'GENEL-000',
          customer: item.customer,
          listName: item.listName || 'Özel Fiyat Listesi',
          validFrom: item.validFrom,
          validUntil: item.validUntil,
          items: []
        });
      }
      groupsMap.get(custId).items.push(item);
    });

    const groupedPriceLists = Array.from(groupsMap.values());

    res.render('sales/price_lists', {
      user: req.user,
      priceLists: rawPriceLists,
      groupedPriceLists,
      customers,
      stockItems,
      error: null,
      success: req.query.success || null
    });
  });

  addPriceList = asyncHandler(async (req, res) => {
    try {
      const listName = req.body.listName || 'Müşteri Özel Fiyat Listesi';
      const customerId = req.body.customerId ? parseInt(req.body.customerId, 10) : null;
      const validFrom = req.body.validFrom || null;
      const validUntil = req.body.validUntil || null;
      const notes = req.body.notes || null;

      const todayStr = new Date().toISOString().split('T')[0];
      if (validFrom && validFrom < todayStr) {
        throw new Error('⚠️ Geçerlilik başlangıç tarihi bugünden eski bir tarih olamaz!');
      }

      let itemsToProcess = [];

      if (req.body.itemsJson) {
        try { itemsToProcess = JSON.parse(req.body.itemsJson); } catch (e) { itemsToProcess = []; }
      }

      if (!Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
        if (req.body.stockItemId) {
          itemsToProcess = [{
            stockItemId: parseInt(req.body.stockItemId, 10),
            specialPrice: parseFloat(req.body.specialPrice) || 0,
            customDiscountRate: parseFloat(req.body.customDiscountRate) || 0,
            currency: req.body.currency || 'TRY'
          }];
        }
      }

      if (itemsToProcess.length === 0) {
        throw new Error('Lütfen özel fiyat tanımlanacak en az 1 adet ürün ekleyiniz.');
      }

      for (const it of itemsToProcess) {
        const stockItemId = parseInt(it.stockItemId, 10);
        if (!stockItemId) continue;

        const stockItem = await StockItem.findByPk(stockItemId);
        if (!stockItem) continue;

        const specPrice = parseFloat(it.specialPrice) || 0;
        const stdPrice = parseFloat(stockItem.salePrice) || 0;

        if (specPrice > stdPrice) {
          throw new Error(`⚠️ [${stockItem.stockCode}] ${stockItem.name} ürünü için girilen özel fiyat (${specPrice.toLocaleString('tr-TR')} TL), ürünün standart liste satış fiyatından (${stdPrice.toLocaleString('tr-TR')} TL) daha yüksek olamaz!`);
        }

        const discRate = parseFloat(it.customDiscountRate) || 0;
        const curr = it.currency || 'TRY';

        const existing = await CustomerPriceList.findOne({
          where: {
            customerId: customerId,
            stockItemId: stockItemId
          }
        });

        if (existing) {
          await existing.update({
            listName,
            specialPrice: specPrice,
            customDiscountRate: discRate,
            currency: curr,
            validFrom,
            validUntil,
            notes,
            status: 'Active'
          });
        } else {
          await priceListRepository.create({
            listName,
            customerId,
            stockItemId,
            specialPrice: specPrice,
            customDiscountRate: discRate,
            currency: curr,
            validFrom,
            validUntil,
            notes,
            status: 'Active'
          }, req.user);
        }
      }

      res.redirect('/sales/price-lists?success=' + encodeURIComponent('✅ Müşteri özel fiyat listesi başarıyla kaydedildi.'));
    } catch (err) {
      const rawPriceLists = await priceListRepository.findAll();
      const customers = await customerRepository.findAll({ status: 'Active' });
      const stockItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });

      const groupsMap = new Map();
      rawPriceLists.forEach(item => {
        const custId = item.customerId || 0;
        if (!groupsMap.has(custId)) {
          groupsMap.set(custId, {
            customerId: item.customerId,
            customerName: item.customer ? item.customer.companyName : 'Tüm Müşteriler (Genel İskonto)',
            customerCode: item.customer ? item.customer.customerCode : 'GENEL-000',
            customer: item.customer,
            listName: item.listName || 'Özel Fiyat Listesi',
            validFrom: item.validFrom,
            validUntil: item.validUntil,
            items: []
          });
        }
        groupsMap.get(custId).items.push(item);
      });

      res.render('sales/price_lists', {
        user: req.user,
        priceLists: rawPriceLists,
        groupedPriceLists: Array.from(groupsMap.values()),
        customers,
        stockItems,
        error: err.message || 'Fiyat listesi kaydı oluşturulurken hata oluştu.',
        success: null
      });
    }
  });

  deleteCustomerPriceLists = asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const targetCustId = customerId === '0' || customerId === 'null' ? null : parseInt(customerId, 10);
    
    await CustomerPriceList.destroy({ where: { customerId: targetCustId } });
    res.redirect('/sales/price-lists?success=' + encodeURIComponent('✅ Seçilen müşteriye ait özel fiyat tanımları silindi.'));
  });

  deletePriceListItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await CustomerPriceList.destroy({ where: { id: parseInt(id, 10) } });
    res.redirect('/sales/price-lists?success=' + encodeURIComponent('✅ Özel fiyat ürünü silindi.'));
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

  async getOpenOrdersWithDispatchedMap() {
    const openOrders = await SaleOrder.findAll({
      where: { status: { [Op.ne]: 'Completed' } },
      include: [{ model: StockItem, as: 'stockItem' }],
      order: [['createdAt', 'DESC']]
    });

    const openOrdersData = [];
    for (const order of openOrders) {
      const orderPlain = order.get({ plain: true });

      const existingDispatches = await SaleDispatchNote.findAll({
        where: { saleOrderId: order.id }
      });

      const dispatchedQtyMap = {};
      for (const d of existingDispatches) {
        if (d.itemsJson) {
          try {
            const dItems = typeof d.itemsJson === 'string' ? JSON.parse(d.itemsJson) : d.itemsJson;
            if (Array.isArray(dItems)) {
              dItems.forEach(it => {
                const sId = String(it.stockItemId || order.stockItemId || '');
                const q = parseFloat(it.dispatchQuantity || it.quantity || 0);
                dispatchedQtyMap[sId] = (dispatchedQtyMap[sId] || 0) + q;
              });
            }
          } catch (e) {}
        }
      }

      orderPlain.dispatchedQtyMap = dispatchedQtyMap;
      openOrdersData.push(orderPlain);
    }
    return openOrdersData;
  }

  // 4. SEVKİYAT VE İRSALİYELER
  listDispatches = asyncHandler(async (req, res) => {
    const dispatches = await dispatchRepository.findAll();
    const openOrders = await this.getOpenOrdersWithDispatchedMap();
    const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
    const nextTrackingNo = await dispatchRepository.getNextTrackingNo();

    res.render('sales/dispatches', {
      user: req.user,
      dispatches,
      openOrders,
      nextDispatchNo,
      nextTrackingNo,
      error: null
    });
  });

  addDispatch = asyncHandler(async (req, res) => {
    const { 
      saleOrderId, dispatchType, shipmentDate, exitWarehouse, deliveryCity, 
      deliveryDistrict, recipientPerson, deliveryType, projectNo, carrierCompany, 
      vehiclePlate, driverName, notes, itemsJson 
    } = req.body;
    
    const order = await SaleOrder.findByPk(saleOrderId, {
      include: [{ model: StockItem, as: 'stockItem' }]
    });

    if (!order) {
      const dispatches = await dispatchRepository.findAll();
      const openOrders = await this.getOpenOrdersWithDispatchedMap();
      const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
      const nextTrackingNo = await dispatchRepository.getNextTrackingNo();
      return res.render('sales/dispatches', {
        user: req.user,
        dispatches,
        openOrders,
        nextDispatchNo,
        nextTrackingNo,
        error: '⚠️ Lütfen geçerli bir sipariş seçiniz.'
      });
    }

    if (order.status === 'Completed') {
      const dispatches = await dispatchRepository.findAll();
      const openOrders = await this.getOpenOrdersWithDispatchedMap();
      const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
      const nextTrackingNo = await dispatchRepository.getNextTrackingNo();
      return res.render('sales/dispatches', {
        user: req.user,
        dispatches,
        openOrders,
        nextDispatchNo,
        nextTrackingNo,
        error: '⚠️ Tamamlanmış siparişler için tekrar sevk irsaliyesi oluşturulamaz.'
      });
    }

    // Parse itemsJson
    let parsedItems = [];
    if (itemsJson) {
      try {
        parsedItems = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
      } catch (e) {
        parsedItems = [];
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      if (order.itemsJson) {
        try { parsedItems = JSON.parse(order.itemsJson); } catch (e) { parsedItems = []; }
      }
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        parsedItems = [{
          stockItemId: order.stockItemId,
          stockCode: order.stockItem ? order.stockItem.stockCode : '',
          name: order.stockItem ? order.stockItem.name : 'Ürün Kalemi',
          orderedQuantity: order.quantity,
          dispatchQuantity: order.quantity,
          unitPrice: order.unitPrice
        }];
      } else {
        parsedItems = parsedItems.map(it => ({
          ...it,
          orderedQuantity: parseFloat(it.quantity) || 1,
          dispatchQuantity: parseFloat(it.quantity) || 1
        }));
      }
    }

    // Compute cumulative dispatched quantities so far for each item in this order
    const existingDispatches = await SaleDispatchNote.findAll({
      where: { saleOrderId: order.id }
    });

    const dispatchedQtyMap = {};
    for (const d of existingDispatches) {
      if (d.itemsJson) {
        try {
          const dItems = typeof d.itemsJson === 'string' ? JSON.parse(d.itemsJson) : d.itemsJson;
          if (Array.isArray(dItems)) {
            dItems.forEach(it => {
              const sId = String(it.stockItemId || order.stockItemId || '');
              const q = parseFloat(it.dispatchQuantity || it.quantity || 0);
              dispatchedQtyMap[sId] = (dispatchedQtyMap[sId] || 0) + q;
            });
          }
        } catch (e) {}
      }
    }

    let totalDispatchedQty = 0;

    for (const item of parsedItems) {
      const sIdKey = String(item.stockItemId || order.stockItemId || '');
      const orderedQty = parseFloat(item.orderedQuantity || item.quantity) || 0;
      const alreadyDispatched = dispatchedQtyMap[sIdKey] || 0;
      const remainingQty = Math.max(0, orderedQty - alreadyDispatched);
      const dispatchQty = parseFloat(item.dispatchQuantity);

      if (isNaN(dispatchQty) || dispatchQty < 0) {
        const dispatches = await dispatchRepository.findAll();
        const openOrders = await this.getOpenOrdersWithDispatchedMap();
        const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
        const nextTrackingNo = await dispatchRepository.getNextTrackingNo();
        return res.render('sales/dispatches', {
          user: req.user,
          dispatches,
          openOrders,
          nextDispatchNo,
          nextTrackingNo,
          error: `⚠️ HATA: "${item.name || 'Ürün'}" için sevk miktarı negatif olamaz!`
        });
      }

      if (dispatchQty > remainingQty) {
        const dispatches = await dispatchRepository.findAll();
        const openOrders = await this.getOpenOrdersWithDispatchedMap();
        const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
        const nextTrackingNo = await dispatchRepository.getNextTrackingNo();
        return res.render('sales/dispatches', {
          user: req.user,
          dispatches,
          openOrders,
          nextDispatchNo,
          nextTrackingNo,
          error: `⚠️ HATA: "${item.name || 'Ürün'}" için sevk edilecek miktar (${dispatchQty} Adet), kalan sevk edilebilir miktarı (${remainingQty} Adet) geçemez!`
        });
      }

      totalDispatchedQty += dispatchQty;
    }

    if (totalDispatchedQty <= 0) {
      const dispatches = await dispatchRepository.findAll();
      const openOrders = await this.getOpenOrdersWithDispatchedMap();
      const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
      const nextTrackingNo = await dispatchRepository.getNextTrackingNo();
      return res.render('sales/dispatches', {
        user: req.user,
        dispatches,
        openOrders,
        nextDispatchNo,
        nextTrackingNo,
        error: '⚠️ HATA: Tüm ürünlerin sevk miktarı 0 olamaz. İrsaliye kesmek için en az 1 üründen miktar girilmelidir!'
      });
    }

    const nextDispatchNo = await dispatchRepository.getNextDispatchNo();
    const nextTrackingNo = await dispatchRepository.getNextTrackingNo();

    await dispatchRepository.create({
      dispatchNo: nextDispatchNo,
      dispatchType: dispatchType || 'Satış İrsaliyesi',
      saleOrderId: order.id,
      customerId: order.customerId,
      customerName: order.customerName,
      dispatchDate: new Date().toISOString().split('T')[0],
      shipmentDate: shipmentDate || new Date().toISOString().split('T')[0],
      exitWarehouse: exitWarehouse || 'Merkez Lojistik Deposu',
      carrierCompany: carrierCompany || null,
      vehiclePlate: vehiclePlate || null,
      driverName: driverName || null,
      trackingNo: nextTrackingNo,
      shippingAddress: order.shippingAddress || null,
      deliveryCity: deliveryCity || null,
      deliveryDistrict: deliveryDistrict || null,
      recipientPerson: recipientPerson || null,
      deliveryType: deliveryType || null,
      projectNo: projectNo || null,
      status: 'Dispatched',
      notes: notes || null,
      itemsJson: JSON.stringify(parsedItems)
    }, req.user, req.ip);

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

    // Find all saleOrderIds that already have an invoice
    const existingInvoices = await SaleInvoice.findAll({
      attributes: ['saleOrderId'],
      where: { saleOrderId: { [Op.ne]: null } }
    });
    const invoicedOrderIds = existingInvoices.map(inv => inv.saleOrderId).filter(id => !!id);

    // Only load Completed orders that DO NOT have an invoice yet
    const completedOrders = await SaleOrder.findAll({
      where: {
        status: 'Completed',
        id: { [Op.notIn]: invoicedOrderIds.length > 0 ? invoicedOrderIds : [0] }
      },
      include: [{ model: StockItem, as: 'stockItem' }],
      order: [['createdAt', 'DESC']]
    });

    res.render('sales/invoices', {
      user: req.user,
      invoices,
      completedOrders,
      error: req.query.error || null,
      success: req.query.success || null
    });
  });

  createInvoiceFromOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await SaleOrder.findByPk(id, {
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: CustomerAccount, as: 'customer' }
      ]
    });

    if (!order) {
      return res.redirect('/sales/invoices?error=' + encodeURIComponent('⚠️ Sipariş kaydı bulunamadı.'));
    }

    if (order.status !== 'Completed') {
      return res.redirect('/sales/invoices?error=' + encodeURIComponent('⚠️ Yalnızca teslimatı tamamlanmış (Tamamlandı durumundaki) siparişler için satış faturası kesilebilir.'));
    }

    // Double-check if an invoice already exists for this order
    const existingInvoice = await SaleInvoice.findOne({ where: { saleOrderId: order.id } });
    if (existingInvoice) {
      return res.redirect('/sales/invoices?error=' + encodeURIComponent(`⚠️ Bu sipariş (${order.orderNo}) için daha önce ${existingInvoice.invoiceNo} numaralı satış faturası kesilmiştir! Tekrar fatura oluşturulamaz.`));
    }

    // Find dispatch note if available
    const dispatchNote = await SaleDispatchNote.findOne({ where: { saleOrderId: order.id } });

    const nextInvoiceNo = await invoiceRepository.getNextInvoiceNo();
    
    // Read from body if form/modal was submitted, else set rich defaults
    const invoiceScenario = req.body.invoiceScenario || 'EARSIVFATURA';
    const invoiceType = req.body.invoiceType || 'SATIS';
    const paymentType = req.body.paymentType || order.paymentTerm || 'Vadeli';
    const paymentTermDays = parseInt(req.body.paymentTermDays, 10) || 30;
    
    const invoiceDate = req.body.invoiceDate || new Date().toISOString().split('T')[0];
    const now = new Date();
    const invoiceTime = req.body.invoiceTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    const dueDateObj = new Date(invoiceDate);
    dueDateObj.setDate(dueDateObj.getDate() + paymentTermDays);
    const dueDate = req.body.dueDate || dueDateObj.toISOString().split('T')[0];

    const bankName = req.body.bankName || 'Ziraat Bankası A.Ş. - Maslak Ticari Şubesi';
    const ibanNo = req.body.ibanNo || 'TR56 0001 0002 0003 0004 0005 06';
    const ettnNo = req.body.ettnNo || require('crypto').randomUUID();

    // Prepare itemsJson if not present on order
    let itemsJsonStr = order.itemsJson;
    if (!itemsJsonStr) {
      itemsJsonStr = JSON.stringify([{
        stockItemId: order.stockItemId,
        stockCode: order.stockItem ? order.stockItem.stockCode : 'STK-001',
        name: order.stockItem ? order.stockItem.name : 'Ürün Kalemi',
        quantity: parseFloat(order.quantity) || 1,
        unit: order.stockItem ? order.stockItem.unit : 'Adet',
        unitPrice: parseFloat(order.unitPrice) || 0,
        discountRate: parseFloat(order.discountRate) || 0,
        discountAmount: parseFloat(order.discountAmount) || 0,
        taxRate: parseFloat(order.taxRate) || 20,
        taxAmount: parseFloat(order.taxAmount) || 0,
        totalAmount: parseFloat(order.totalAmount) || 0
      }]);
    }

    const invoice = await invoiceRepository.create({
      invoiceNo: nextInvoiceNo,
      saleOrderId: order.id,
      dispatchNoteId: dispatchNote ? dispatchNote.id : null,
      customerId: order.customerId,
      customerName: order.customerName,
      customerTaxNo: order.customerTaxNo || (order.customer ? order.customer.taxNo : '1234567890'),
      customerTaxOffice: order.customer ? order.customer.taxOffice : 'Maslak V.D.',
      billingAddress: order.billingAddress || (order.customer ? order.customer.address : 'Maslak Mah. Büyükdere Cad. No:100 Şişli / İstanbul'),
      shippingAddress: order.shippingAddress || (order.customer ? order.customer.address : 'Maslak Mah. Büyükdere Cad. No:100 Şişli / İstanbul'),
      customerPhone: order.customerPhone || (order.customer ? order.customer.phone : '+90 212 555 0100'),
      customerEmail: order.customerEmail || (order.customer ? order.customer.email : 'bilgi@musteri.com'),
      invoiceDate: invoiceDate,
      invoiceTime: invoiceTime,
      dueDate: dueDate,
      invoiceType: invoiceType,
      invoiceScenario: invoiceScenario,
      ettnNo: ettnNo,
      orderNo: order.orderNo,
      orderDate: order.orderDate,
      dispatchNo: dispatchNote ? dispatchNote.dispatchNo : null,
      dispatchDate: dispatchNote ? dispatchNote.dispatchDate : null,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      currency: order.currency || 'TRY',
      exchangeRate: parseFloat(req.body.exchangeRate) || 1.0000,
      paymentType: paymentType,
      paymentTermDays: paymentTermDays,
      bankName: bankName,
      ibanNo: ibanNo,
      paymentStatus: 'Unpaid',
      status: 'Issued',
      itemsJson: itemsJsonStr,
      notes: req.body.notes || `[Sipariş No: ${order.orderNo}] numaralı tamamlanan satış siparişi faturaya dönüştürüldü.`
    }, req.user, req.ip);

    if (order.customerId) {
      await customerLedgerRepository.addEntry({
        customerId: order.customerId,
        transactionDate: invoice.invoiceDate,
        transactionType: 'Sale_Invoice',
        documentNo: invoice.invoiceNo,
        description: `[Satış Faturası] ${invoice.invoiceNo} no'lu fatura kaydı`,
        debitAmount: invoice.totalAmount,
        creditAmount: 0,
        currency: invoice.currency
      }, req.user);
    }

    res.redirect('/sales/invoices?success=' + encodeURIComponent(`✅ ${invoice.invoiceNo} numaralı satış faturası başarıyla oluşturuldu ve cari borç bakiyesine işlendi.`));
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
      const status = action === 'approve' ? 'Approved' : 'Rejected';
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
