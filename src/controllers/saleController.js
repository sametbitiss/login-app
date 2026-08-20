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
const { StokKarti, SatisSiparisi, SatisTeklifi, MusteriHesabi, SatisFaturasi, SatisIrsaliyesi, MusteriFiyatListesi, DovizKuru, MusteriCariHareket, Kullanici } = require('../../models');
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
    const stockItems = await StokKarti.findAll({
      where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['ad', 'ASC']]
    });
    const customers = await customerRepository.findAll({ status: 'Active' });
    const exchangeRates = await exchangeRateRepository.getLatestRates();
    const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });

    res.render('sales/add', {
      user: req.user,
      error: null,
      nextOrderNo,
      stockItems,
      customers,
      exchangeRates,
      priceLists,
      formData: {}
    });
  });

  _parseItemsFromRequest = async (req) => {
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
    const itemsJson = req.body.itemsJson || req.body.kalemlerJson;
    if (itemsJson) {
      try {
        const parsed = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
        if (Array.isArray(parsed) && parsed.length > 0) {
          items = parsed.filter(it => it && (it.stokId || it.stockItemId || it.ad || it.name));
        }
      } catch (e) { items = []; }
    }

    if (items.length === 0) {
      const stokIdArr = req.body['stokId[]'] || req.body['stockItemId[]'] || (Array.isArray(req.body.stokId) ? req.body.stokId : (Array.isArray(req.body.stockItemId) ? req.body.stockItemId : null));
      if (Array.isArray(stokIdArr) && stokIdArr.length > 0) {
        const miktarArr = req.body['miktar[]'] || req.body['quantity[]'] || (Array.isArray(req.body.miktar) ? req.body.miktar : (Array.isArray(req.body.quantity) ? req.body.quantity : []));
        const birimFiyatArr = req.body['birimFiyat[]'] || req.body['unitPrice[]'] || (Array.isArray(req.body.birimFiyat) ? req.body.birimFiyat : (Array.isArray(req.body.unitPrice) ? req.body.unitPrice : []));
        const iskontoArr = req.body['iskontoOrani[]'] || req.body['discountRate[]'] || (Array.isArray(req.body.iskontoOrani) ? req.body.iskontoOrani : (Array.isArray(req.body.discountRate) ? req.body.discountRate : []));
        const kdvArr = req.body['kdvOrani[]'] || req.body['taxRate[]'] || (Array.isArray(req.body.kdvOrani) ? req.body.kdvOrani : (Array.isArray(req.body.taxRate) ? req.body.taxRate : []));

        stokIdArr.forEach((sId, idx) => {
          const parsedId = safeInt(sId);
          if (parsedId && parsedId > 0) {
            items.push({
              stokId: parsedId,
              stockItemId: parsedId,
              miktar: safeFloat(miktarArr[idx], 1),
              quantity: safeFloat(miktarArr[idx], 1),
              birimFiyat: safeFloat(birimFiyatArr[idx], 0),
              unitPrice: safeFloat(birimFiyatArr[idx], 0),
              iskontoOrani: safeFloat(iskontoArr[idx], 0),
              discountRate: safeFloat(iskontoArr[idx], 0),
              kdvOrani: safeFloat(kdvArr[idx], 20),
              taxRate: safeFloat(kdvArr[idx], 20)
            });
          }
        });
      }
    }

    if (items.length === 0) {
      const stockItemId = safeInt(req.body.stokId || req.body.stockItemId);
      if (stockItemId && stockItemId > 0) {
        items = [{
          stokId: stockItemId,
          stockItemId: stockItemId,
          miktar: safeFloat(req.body.miktar !== undefined ? req.body.miktar : req.body.quantity, 1),
          quantity: safeFloat(req.body.miktar !== undefined ? req.body.miktar : req.body.quantity, 1),
          birimFiyat: safeFloat(req.body.birimFiyat !== undefined ? req.body.birimFiyat : req.body.unitPrice, 0),
          unitPrice: safeFloat(req.body.birimFiyat !== undefined ? req.body.birimFiyat : req.body.unitPrice, 0),
          iskontoOrani: safeFloat(req.body.iskontoOrani !== undefined ? req.body.iskontoOrani : req.body.discountRate, 0),
          discountRate: safeFloat(req.body.iskontoOrani !== undefined ? req.body.iskontoOrani : req.body.discountRate, 0),
          kdvOrani: safeFloat(req.body.kdvOrani !== undefined ? req.body.kdvOrani : req.body.taxRate, 20),
          taxRate: safeFloat(req.body.kdvOrani !== undefined ? req.body.kdvOrani : req.body.taxRate, 20)
        }];
      }
    }

    let grandSubtotal = 0;
    let grandDiscountAmount = 0;
    let grandTaxAmount = 0;
    let grandTotalAmount = 0;
    let maxDiscountRate = 0;
    const processedItems = [];

    for (const item of items) {
      const qty = safeFloat(item.miktar !== undefined ? item.miktar : item.quantity, 1);
      const price = safeFloat(item.birimFiyat !== undefined ? item.birimFiyat : item.unitPrice, 0);
      const disc = safeFloat(item.iskontoOrani !== undefined ? item.iskontoOrani : item.discountRate, 0);
      const tax = safeFloat(item.kdvOrani !== undefined ? item.kdvOrani : item.taxRate, 20);

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

      const itemId = safeInt(item.stokId || item.stockItemId);
      let itemName = (item.ad || item.name || '').trim();
      let stockCode = (item.stokKodu || item.stockCode || '').trim();
      let unit = (item.birim || item.unit || 'Adet').trim();

      if (!itemName || itemName === 'Ürün Kalemi' || itemName === 'Seçilen Ürün') {
        itemName = '';
      }
      if (!stockCode || stockCode === '—' || stockCode === 'STOK-N/A') {
        stockCode = '';
      }

      if (itemId && itemId > 0) {
        const st = await StokKarti.findByPk(itemId);
        if (st) {
          if (!itemName) itemName = st.ad;
          if (!stockCode) stockCode = st.stokKodu;
          if (!unit) unit = st.birim;
        }
      }
      if (!itemName) itemName = 'Ürün Kalemi';
      if (!stockCode) stockCode = '—';

      processedItems.push({
        stokId: itemId && itemId > 0 ? itemId : null,
        stockItemId: itemId && itemId > 0 ? itemId : null,
        stokKodu: stockCode,
        stockCode: stockCode,
        ad: itemName,
        name: itemName,
        birim: unit,
        unit: unit,
        miktar: qty,
        quantity: qty,
        birimFiyat: price,
        unitPrice: price,
        iskontoOrani: disc,
        discountRate: disc,
        kdvOrani: tax,
        taxRate: tax,
        araToplam: sub,
        subtotal: sub,
        iskontoTutari: discAmt,
        discountAmount: discAmt,
        kdvTutari: taxAmt,
        taxAmount: taxAmt,
        toplamTutar: tot,
        totalAmount: tot
      });
    }

    return {
      processedItems,
      grandSubtotal,
      grandDiscountAmount,
      grandTaxAmount,
      grandTotalAmount,
      maxDiscountRate
    };
  };

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

      const parsedData = await this._parseItemsFromRequest(req);
      const processedItems = parsedData.processedItems;
      const grandSubtotal = parsedData.grandSubtotal;
      const grandDiscountAmount = parsedData.grandDiscountAmount;
      const grandTaxAmount = parsedData.grandTaxAmount;
      const grandTotalAmount = parsedData.grandTotalAmount;
      const maxDiscountRate = parsedData.maxDiscountRate;

      const primaryItem = processedItems[0] || {};
      let primaryStockItemId = safeInt(primaryItem.stokId);
      if (!primaryStockItemId || primaryStockItemId <= 0) {
        const defaultStock = await StokKarti.findOne({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } } });
        primaryStockItemId = defaultStock ? defaultStock.id : 1;
      }
      const customerId = safeInt(req.body.musteriId || req.body.customerId);

      if (customerId) {
        const cust = await customerRepository.findById(customerId);
        if (cust) {
          const score = cust.musteriSkoru !== undefined ? cust.musteriSkoru : 85;
          const riskLvl = cust.riskSeviyesi || cust.riskLevel;
          const isBlocked = score < 50 || riskLvl === 'High' || riskLvl === 'Blocked' || riskLvl === 'Critical';
          if (isBlocked) {
            const nextOrderNo = await saleService.getNextOrderNo();
            const stockItems = await StokKarti.findAll({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }, order: [['ad', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });
            return res.render('sales/add', {
              user: req.user,
              nextOrderNo,
              stockItems,
              customers,
              exchangeRates,
              priceLists,
              formData: req.body,
              error: `⚠️ Seçilen müşterinin skoru yetersizdir (Puan: ${score}/100, Risk: ${riskLvl}). Yüksek riskli müşterilere yeni sipariş oluşturulamaz!`
            });
          }

          const creditLimit = parseFloat(cust.krediLimiti || cust.creditLimit) || 0;
          const currentBalance = parseFloat(cust.guncelBakiye || cust.currentBalance) || 0;
          const availableCredit = creditLimit - currentBalance;

          if (creditLimit > 0 && grandTotalAmount > availableCredit) {
            const nextOrderNo = await saleService.getNextOrderNo();
            const stockItems = await StokKarti.findAll({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }, order: [['ad', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });
            return res.render('sales/add', {
              user: req.user,
              nextOrderNo,
              stockItems,
              customers,
              exchangeRates,
              priceLists,
              formData: req.body,
              error: `⚠️ Risk Limiti Aşımı! Müşterinin kullanılabilir risk limiti (${availableCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL), sipariş tutarından (${grandTotalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL) azdır. Risk limiti aşılacağı için bu sipariş oluşturulamaz! (Toplam Limit: ${creditLimit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL, Borç Bakiyesi: ${currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)`
            });
          }
        }
      }

      const customerName = (req.body.musteriAdi || req.body.customerName || '').trim() || 'Genel Müşteri';
      let rawCurrency = req.body.paraBirimi || req.body.currency || 'TRY';
      let currency = 'TRY';
      if (rawCurrency.includes('USD')) currency = 'USD';
      else if (rawCurrency.includes('EUR')) currency = 'EUR';

      const highDiscountReasons = [];
      for (const item of processedItems) {
        if (item.iskontoOrani > 20) {
          const discountVal = parseFloat(item.iskontoOrani).toLocaleString('tr-TR');
          highDiscountReasons.push(`${item.ad || 'Ürün'} (%${discountVal} iskonto)`);
        }
      }

      let approvalNeeded = false;
      let approvalReason = null;

      if (highDiscountReasons.length > 0 && grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek İskonto: ${highDiscountReasons.join(', ')} ve Yüksek Tutar (${grandTotalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency} > 100.000 TL)`;
      } else if (highDiscountReasons.length > 0) {
        approvalNeeded = true;
        approvalReason = `Yüksek Ürün İskontosu: ${highDiscountReasons.join(', ')} (Yönetsel onay sınırı: %20)`;
      } else if (grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek Sipariş Tutarı (${grandTotalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency} > 100.000 TL)`;
      }

      const status = approvalNeeded ? 'Pending_Approval' : 'Approved';
      const nextOrderNo = await saleService.getNextOrderNo();
      let rawPaymentTerm = req.body.odemeVadesi || req.body.paymentTerm || 'Pesin';
      let paymentTerm = 'Pesin';
      if (rawPaymentTerm.includes('30') || rawPaymentTerm === 'Vadeli_30') paymentTerm = 'Vadeli_30';
      else if (rawPaymentTerm.includes('60') || rawPaymentTerm === 'Vadeli_60') paymentTerm = 'Vadeli_60';
      else if (rawPaymentTerm.includes('90') || rawPaymentTerm === 'Vadeli_90') paymentTerm = 'Vadeli_90';
      else if (rawPaymentTerm.toLowerCase().includes('kredi') || rawPaymentTerm === 'Kredi_Karti') paymentTerm = 'Kredi_Karti';
      else paymentTerm = 'Pesin';

      await saleService.createOrder({
        siparisNo: nextOrderNo,
        musteriId: customerId,
        musteriAdi: customerName,
        musteriVergiNo: req.body.musteriVergiNo || req.body.customerTaxNo ? (req.body.musteriVergiNo || req.body.customerTaxNo).trim() : null,
        musteriTelefon: req.body.musteriTelefon || req.body.customerPhone ? (req.body.musteriTelefon || req.body.customerPhone).trim() : null,
        siparisTarihi: new Date().toISOString().split('T')[0],
        teslimTarihi: req.body.teslimTarihi || req.body.deliveryDate || null,
        odemeVadesi: paymentTerm,
        durum: status,
        onayGerekli: approvalNeeded,
        onayNedeni: approvalReason,
        oncelik: req.body.oncelik || req.body.priority || 'Normal',
        stokId: primaryStockItemId,
        miktar: safeFloat(primaryItem.miktar, 1),
        birimFiyat: safeFloat(primaryItem.birimFiyat, 0),
        iskontoOrani: maxDiscountRate,
        kdvOrani: safeFloat(primaryItem.kdvOrani, 20),
        araToplam: grandSubtotal,
        iskontoTutari: grandDiscountAmount,
        kdvTutari: grandTaxAmount,
        toplamTutar: grandTotalAmount,
        paraBirimi: currency,
        kalemlerJson: JSON.stringify(processedItems),
        teslimatAdresi: req.body.teslimatAdresi || req.body.shippingAddress || null,
        faturaAdresi: req.body.faturaAdresi || req.body.billingAddress || null,
        satisTemsilcisi: req.body.satisTemsilcisi || req.body.salesRep || (req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi),
        notlar: req.body.notlar || req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/sales/orders');
    } catch (err) {
      const nextOrderNo = await saleService.getNextOrderNo();
      const stockItems = await StokKarti.findAll({
        where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }
      });
      const customers = await customerRepository.findAll({ status: 'Active' });
      const exchangeRates = await exchangeRateRepository.getLatestRates();
      const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });

      res.render('sales/add', {
        user: req.user,
        error: err.message || 'Sipariş oluşturulurken bir hata oluştu.',
        nextOrderNo,
        stockItems,
        customers,
        exchangeRates,
        priceLists,
        formData: req.body
      });
    }
  });

  renderEditOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await saleService.getOrderById(id);
    const stockItems = await StokKarti.findAll({
      where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['ad', 'ASC']]
    });
    const customers = await customerRepository.findAll({ status: 'Active' });
    const exchangeRates = await exchangeRateRepository.getLatestRates();
    const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });

    res.render('sales/edit', {
      user: req.user,
      order,
      stockItems,
      customers,
      exchangeRates,
      priceLists,
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

      let items = [];
      const itemsJson = req.body.itemsJson || req.body.kalemlerJson;
      if (itemsJson) {
        try {
          items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson;
        } catch (e) {
          items = [];
        }
      }

      if (!Array.isArray(items) || items.length === 0) {
        const stockItemId = safeInt(req.body.stokId || req.body.stockItemId);
        const quantity = safeFloat(req.body.miktar !== undefined ? req.body.miktar : req.body.quantity, 1);
        const unitPrice = safeFloat(req.body.birimFiyat !== undefined ? req.body.birimFiyat : req.body.unitPrice, 0);
        const discountRate = safeFloat(req.body.iskontoOrani !== undefined ? req.body.iskontoOrani : req.body.discountRate, 0);
        const taxRate = safeFloat(req.body.kdvOrani !== undefined ? req.body.kdvOrani : req.body.taxRate, 20);

        const subtotal = quantity * unitPrice;
        const discountAmount = subtotal * (discountRate / 100);
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * (taxRate / 100);
        const totalAmount = afterDiscount + taxAmount;

        items = [{
          stokId: stockItemId,
          miktar: quantity,
          birimFiyat: unitPrice,
          iskontoOrani: discountRate,
          kdvOrani: taxRate,
          araToplam: subtotal,
          iskontoTutari: discountAmount,
          kdvTutari: taxAmount,
          toplamTutar: totalAmount
        }];
      }

      let grandSubtotal = 0;
      let grandDiscountAmount = 0;
      let grandTaxAmount = 0;
      let grandTotalAmount = 0;

      const processedItems = [];
      for (const item of items) {
        const itemId = safeInt(item.stokId || item.stockItemId);
        const q = safeFloat(item.miktar !== undefined ? item.miktar : item.quantity, 1);
        const p = safeFloat(item.birimFiyat !== undefined ? item.birimFiyat : item.unitPrice, 0);
        const d = safeFloat(item.iskontoOrani !== undefined ? item.iskontoOrani : item.discountRate, 0);
        const t = safeFloat(item.kdvOrani !== undefined ? item.kdvOrani : item.taxRate, 20);

        const sub = q * p;
        const disc = sub * (d / 100);
        const afterDisc = sub - disc;
        const tax = afterDisc * (t / 100);
        const tot = afterDisc + tax;

        grandSubtotal += sub;
        grandDiscountAmount += disc;
        grandTaxAmount += tax;
        grandTotalAmount += tot;

        let itemName = item.ad || item.name || '';
        let stockCode = item.stokKodu || item.stockCode || '';
        if (itemId) {
          const st = await StokKarti.findByPk(itemId);
          if (st) {
            itemName = st.ad;
            stockCode = st.stokKodu;
          }
        }

        processedItems.push({
          stokId: itemId,
          stockItemId: itemId,
          stokKodu: stockCode,
          stockCode: stockCode,
          name: itemName,
          ad: itemName,
          quantity: q,
          miktar: q,
          unitPrice: p,
          birimFiyat: p,
          discountRate: d,
          iskontoOrani: d,
          taxRate: t,
          kdvOrani: t,
          subtotal: sub,
          araToplam: sub,
          discountAmount: disc,
          iskontoTutari: disc,
          taxAmount: tax,
          kdvTutari: tax,
          totalAmount: tot,
          toplamTutar: tot
        });
      }

      const primaryItem = processedItems[0] || {};
      let stockItemId = safeInt(primaryItem.stokId);
      if (!stockItemId || stockItemId <= 0) {
        const defaultStock = await StokKarti.findOne({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } } });
        stockItemId = defaultStock ? defaultStock.id : 1;
      }

      await saleService.updateOrder(id, {
        musteriAdi: req.body.musteriAdi ? req.body.musteriAdi.trim() : (req.body.customerName ? req.body.customerName.trim() : ''),
        musteriVergiNo: req.body.musteriVergiNo || req.body.customerTaxNo || null,
        musteriEposta: req.body.musteriEposta || req.body.customerEmail || null,
        musteriTelefon: req.body.musteriTelefon || req.body.customerPhone || null,
        siparisTarihi: req.body.siparisTarihi || req.body.orderDate,
        teslimTarihi: req.body.teslimTarihi || req.body.deliveryDate || null,
        odemeVadesi: req.body.odemeVadesi || req.body.paymentTerm,
        durum: req.body.durum || req.body.status,
        oncelik: req.body.oncelik || req.body.priority,
        stokId: stockItemId,
        miktar: safeFloat(primaryItem.miktar, 1),
        birimFiyat: safeFloat(primaryItem.birimFiyat, 0),
        iskontoOrani: safeFloat(primaryItem.iskontoOrani, 0),
        kdvOrani: safeFloat(primaryItem.kdvOrani, 20),
        araToplam: grandSubtotal,
        iskontoTutari: grandDiscountAmount,
        kdvTutari: grandTaxAmount,
        toplamTutar: grandTotalAmount,
        paraBirimi: req.body.paraBirimi || req.body.currency || 'TRY',
        teslimatAdresi: req.body.teslimatAdresi || req.body.shippingAddress || null,
        faturaAdresi: req.body.faturaAdresi || req.body.billingAddress || null,
        kalemlerJson: JSON.stringify(processedItems),
        satisTemsilcisi: req.body.satisTemsilcisi || req.body.salesRep || null,
        notlar: req.body.notlar || req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/sales/orders');
    } catch (err) {
      const order = await saleService.getOrderById(id);
      const stockItems = await StokKarti.findAll({
        where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }
      });
      const customers = await customerRepository.findAll({ status: 'Active' });

      res.render('sales/edit', {
        user: req.user,
        order,
        stockItems,
        customers,
        error: err.message || 'Sipariş güncellenirken hata oluştu.'
      });
    }
  });

  viewOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await saleService.getOrderById(id);
    const dispatches = await SatisIrsaliyesi.findAll({ where: { satisSiparisId: id } });
    const invoices = await SatisFaturasi.findAll({ where: { satisSiparisId: id } });

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
    const stockItems = await StokKarti.findAll({
      where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['ad', 'ASC']]
    });
    const customers = await customerRepository.findAll({ status: 'Active' });
    const exchangeRates = await exchangeRateRepository.getLatestRates();
    const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });

    res.render('sales/quotes_add', {
      user: req.user,
      nextQuotationNo,
      stockItems,
      customers,
      exchangeRates,
      priceLists,
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

      const parsedData = await this._parseItemsFromRequest(req);
      const processedItems = parsedData.processedItems;
      const grandSubtotal = parsedData.grandSubtotal;
      const grandDiscountAmount = parsedData.grandDiscountAmount;
      const grandTaxAmount = parsedData.grandTaxAmount;
      const grandTotalAmount = parsedData.grandTotalAmount;
      const maxDiscountRate = parsedData.maxDiscountRate;

      const primaryItem = processedItems[0] || {};
      let primaryStockItemId = safeInt(primaryItem.stokId);
      if (!primaryStockItemId || primaryStockItemId <= 0) {
        const defaultStock = await StokKarti.findOne({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } } });
        primaryStockItemId = defaultStock ? defaultStock.id : 1;
      }
      const customerId = safeInt(req.body.musteriId || req.body.customerId);

      if (customerId) {
        const cust = await customerRepository.findById(customerId);
        if (cust) {
          const score = cust.musteriSkoru !== undefined ? cust.musteriSkoru : 85;
          const riskLvl = cust.riskSeviyesi || cust.riskLevel;
          const isBlocked = score < 50 || riskLvl === 'High' || riskLvl === 'Blocked' || riskLvl === 'Critical';
          if (isBlocked) {
            const nextQuotationNo = await quotationRepository.getNextQuotationNo();
            const stockItems = await StokKarti.findAll({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }, order: [['ad', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });
            return res.render('sales/quotes_add', {
              user: req.user,
              nextQuotationNo,
              stockItems,
              customers,
              exchangeRates,
              priceLists,
              formData: req.body,
              error: `⚠️ Seçilen müşterinin skoru yetersizdir (Puan: ${score}/100, Risk: ${riskLvl}). Yüksek riskli müşterilere yeni teklif hazırlanamaz!`
            });
          }

          const creditLimit = parseFloat(cust.krediLimiti || cust.creditLimit) || 0;
          const currentBalance = parseFloat(cust.guncelBakiye || cust.currentBalance) || 0;
          const availableCredit = creditLimit - currentBalance;

          if (creditLimit > 0 && grandTotalAmount > availableCredit) {
            const nextQuotationNo = await quotationRepository.getNextQuotationNo();
            const stockItems = await StokKarti.findAll({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }, order: [['ad', 'ASC']] });
            const customers = await customerRepository.findAll({ status: 'Active' });
            const exchangeRates = await exchangeRateRepository.getLatestRates();
            const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });
            return res.render('sales/quotes_add', {
              user: req.user,
              nextQuotationNo,
              stockItems,
              customers,
              exchangeRates,
              priceLists,
              formData: req.body,
              error: `⚠️ Risk Limiti Aşımı! Müşterinin kullanılabilir risk limiti (${availableCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL), teklif tutarından (${grandTotalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL) azdır. Risk limiti aşılacağı için bu teklif oluşturulamaz! (Toplam Limit: ${creditLimit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL, Borç Bakiyesi: ${currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)`
            });
          }
        }
      }

      const future = new Date();
      future.setDate(future.getDate() + 15);
      const defaultValidUntil = future.toISOString().split('T')[0];
      const validUntil = (req.body.gecerlilikBitis || req.body.validUntil || '').trim() || defaultValidUntil;

      const customerName = (req.body.musteriAdi || req.body.customerName || '').trim() || 'Genel Müşteri';

      let rawCurrency = req.body.paraBirimi || req.body.currency || 'TRY';
      let currency = 'TRY';
      if (rawCurrency.includes('USD')) currency = 'USD';
      else if (rawCurrency.includes('EUR')) currency = 'EUR';

      const highDiscountReasons = [];
      for (const item of processedItems) {
        if (item.iskontoOrani > 20) {
          const discountVal = parseFloat(item.iskontoOrani).toLocaleString('tr-TR');
          highDiscountReasons.push(`${item.ad || 'Ürün'} (%${discountVal} iskonto)`);
        }
      }

      let approvalNeeded = false;
      let approvalReason = null;

      if (highDiscountReasons.length > 0 && grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek İskonto: ${highDiscountReasons.join(', ')} ve Yüksek Tutar (${grandTotalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency} > 100.000 TL)`;
      } else if (highDiscountReasons.length > 0) {
        approvalNeeded = true;
        approvalReason = `Yüksek Ürün İskontosu: ${highDiscountReasons.join(', ')} (Yönetsel onay sınırı: %20)`;
      } else if (grandTotalAmount > 100000) {
        approvalNeeded = true;
        approvalReason = `Yüksek Teklif Tutarı (${grandTotalAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currency} > 100.000 TL)`;
      }

      await quotationRepository.create({
        teklifNo: req.body.teklifNo || req.body.quotationNo,
        musteriId: customerId,
        musteriAdi: customerName,
        ilgiliKisi: req.body.ilgiliKisi || req.body.contactPerson || null,
        iletisimBilgisi: req.body.iletisimBilgisi || req.body.contactInfo || null,
        faturaAdresi: req.body.faturaAdresi || req.body.billingAddress || null,
        sevkAdresi: req.body.sevkAdresi || req.body.shippingAddress || null,
        istenenTerminTarihi: req.body.istenenTerminTarihi || req.body.requestedDeliveryDate || null,
        teslimatSekli: req.body.teslimatSekli || req.body.deliveryTerms || null,
        teklifTarihi: req.body.teklifTarihi || req.body.quotationDate || new Date().toISOString().split('T')[0],
        gecerlilikBitis: validUntil,
        stokId: primaryStockItemId,
        miktar: safeFloat(primaryItem.miktar, 1),
        birimFiyat: safeFloat(primaryItem.birimFiyat, 0),
        iskontoOrani: maxDiscountRate,
        kdvOrani: safeFloat(primaryItem.kdvOrani, 20),
        araToplam: grandSubtotal,
        iskontoTutari: grandDiscountAmount,
        kdvTutari: grandTaxAmount,
        toplamTutar: grandTotalAmount,
        paraBirimi: currency,
        onayGerekli: approvalNeeded,
        onayNedeni: approvalReason,
        durum: approvalNeeded ? 'Pending_Approval' : 'Approved',
        notlar: req.body.notlar || req.body.notes || null,
        kalemlerJson: JSON.stringify(processedItems)
      }, req.user, req.ip);

      res.redirect('/sales/quotes');
    } catch (err) {
      const nextQuotationNo = await quotationRepository.getNextQuotationNo();
      const stockItems = await StokKarti.findAll({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } } });
      const customers = await customerRepository.findAll({ status: 'Active' });
      const exchangeRates = await exchangeRateRepository.getLatestRates();
      const priceLists = await MusteriFiyatListesi.findAll({ where: { durum: 'Active' } });

      res.render('sales/quotes_add', {
        user: req.user,
        nextQuotationNo,
        stockItems,
        customers,
        exchangeRates,
        priceLists,
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
    const itemsJson = quote.kalemlerJson || quote.itemsJson;
    if (itemsJson) {
      try {
        parsedItems = JSON.parse(itemsJson);
      } catch (e) {
        parsedItems = [];
      }
    }

    if (!parsedItems || parsedItems.length === 0) {
      parsedItems = [{
        stokId: quote.stokId,
        stokKodu: quote.stokKarti ? quote.stokKarti.stokKodu : '-',
        ad: quote.stokKarti ? quote.stokKarti.ad : 'Ürün Kalemi',
        miktar: quote.miktar,
        birimFiyat: quote.birimFiyat,
        iskontoOrani: quote.iskontoOrani,
        kdvOrani: quote.kdvOrani,
        araToplam: quote.araToplam,
        iskontoTutari: quote.iskontoTutari,
        kdvTutari: quote.kdvTutari,
        toplamTutar: quote.toplamTutar
      }];
    }

    const { SirketProfili } = require('../../models');
    let companyProfile = null;
    try {
      if (SirketProfili) {
        await SirketProfili.sync();
        companyProfile = await SirketProfili.findOne({ order: [['id', 'ASC']] });
      }
    } catch (e) {
      companyProfile = null;
    }

    res.render('sales/quote_view', {
      user: req.user,
      quote,
      items: parsedItems,
      companyProfile
    });
  });

  convertQuotationToOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const quote = await quotationRepository.findById(id);

    if (!quote) {
      return res.redirect('/sales/quotes');
    }

    if (quote.durum !== 'Approved') {
      return res.render('error', {
        message: 'Bu teklif yönetsel onay beklemektedir veya onaylanmamıştır. Yönetsel Onaylar ekranından onay verilmeden siparişe dönüştürülemez.',
        error: { status: 403 }
      });
    }

    let custTaxNo = null;
    let custEmail = quote.iletisimBilgisi || null;
    let custPhone = quote.iletisimBilgisi || null;
    let custPaymentTerm = quote.odemeVadesi || quote.paymentTerm || 'Vadeli_30';

    if (quote.musteriId) {
      const cust = await customerRepository.findById(quote.musteriId);
      if (cust) {
        custTaxNo = cust.vergiNo || cust.taxNumber || custTaxNo;
        custEmail = cust.eposta || cust.email || custEmail;
        custPhone = cust.telefon || cust.phone || custPhone;
        if (cust.odemeVadesi || cust.paymentTerm) {
          custPaymentTerm = cust.odemeVadesi || cust.paymentTerm;
        }

        const score = cust.musteriSkoru !== undefined ? cust.musteriSkoru : 85;
        const riskLvl = cust.riskSeviyesi || cust.riskLevel;
        const isBlocked = score < 50 || riskLvl === 'High' || riskLvl === 'Blocked' || riskLvl === 'Critical';
        if (isBlocked) {
          return res.render('error', {
            message: `⚠️ Müşterinin skoru yetersizdir (Puan: ${score}/100, Risk: ${riskLvl}). Yüksek riskli müşterilerin teklifi siparişe dönüştürülemez!`,
            error: { status: 403 }
          });
        }

        const creditLimit = parseFloat(cust.krediLimiti || cust.creditLimit) || 0;
        const currentBalance = parseFloat(cust.guncelBakiye || cust.currentBalance) || 0;
        const availableCredit = creditLimit - currentBalance;
        const quoteTotal = parseFloat(quote.toplamTutar) || 0;

        if (creditLimit > 0 && quoteTotal > availableCredit) {
          return res.render('error', {
            message: `⚠️ Risk Limiti Aşımı! Müşterinin kullanılabilir risk limiti (${availableCredit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL), siparişe dönüştürülmek istenen teklif tutarından (${quoteTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL) azdır. Risk limiti aşılacağı için bu teklif siparişe dönüştürülemez! (Toplam Limit: ${creditLimit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL, Güncel Borç: ${currentBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} TL)`,
            error: { status: 403 }
          });
        }
      }
    }

    // Sanitize payment terms to match SatisSiparisleri ENUM
    const validPaymentTerms = ['Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'];
    let finalPaymentTerm = quote.odemeVadesi || quote.paymentTerm || custPaymentTerm;
    if (!validPaymentTerms.includes(finalPaymentTerm)) {
      if (finalPaymentTerm === 'Cash' || finalPaymentTerm === 'Peşin') finalPaymentTerm = 'Pesin';
      else if (finalPaymentTerm === '30_Days' || finalPaymentTerm === 'Vadeli 30 Gün') finalPaymentTerm = 'Vadeli_30';
      else if (finalPaymentTerm === '60_Days' || finalPaymentTerm === 'Vadeli 60 Gün') finalPaymentTerm = 'Vadeli_60';
      else if (finalPaymentTerm === '90_Days' || finalPaymentTerm === 'Vadeli 90 Gün') finalPaymentTerm = 'Vadeli_90';
      else finalPaymentTerm = 'Vadeli_30';
    }

    // Currency normalization ('TRY', 'USD', 'EUR')
    let finalCurrency = (quote.paraBirimi || 'TRY').toUpperCase();
    if (!['TRY', 'USD', 'EUR'].includes(finalCurrency)) {
      if (finalCurrency === 'TL' || finalCurrency === '₺') finalCurrency = 'TRY';
      else if (finalCurrency === '$') finalCurrency = 'USD';
      else if (finalCurrency === '€') finalCurrency = 'EUR';
      else finalCurrency = 'TRY';
    }

    const teslimatAdresi = quote.sevkAdresi || quote.shippingAddress || null;
    const faturaAdresi = quote.faturaAdresi || quote.billingAddress || null;
    const teslimTarihi = quote.istenenTerminTarihi || quote.requestedDeliveryDate || null;

    const notesCombined = [
      `[Teklif No: ${quote.teklifNo}] Teklif onaylanarak siparişe dönüştürüldü.`,
      quote.notlar || quote.notes || ''
    ].filter(Boolean).join(' • ');

    const nextOrderNo = await saleService.getNextOrderNo();
    await saleService.createOrder({
      siparisNo: nextOrderNo,
      musteriId: quote.musteriId,
      musteriAdi: quote.musteriAdi,
      musteriVergiNo: custTaxNo,
      musteriEposta: custEmail,
      musteriTelefon: custPhone,
      siparisTarihi: new Date().toISOString().split('T')[0],
      teslimTarihi: teslimTarihi,
      odemeVadesi: finalPaymentTerm,
      durum: 'Preparing',
      oncelik: 'Normal',
      stokId: quote.stokId,
      miktar: quote.miktar,
      birimFiyat: quote.birimFiyat,
      iskontoOrani: quote.iskontoOrani,
      kdvOrani: quote.kdvOrani,
      araToplam: quote.araToplam,
      iskontoTutari: quote.iskontoTutari,
      kdvTutari: quote.kdvTutari,
      toplamTutar: quote.toplamTutar,
      paraBirimi: finalCurrency,
      faturaAdresi: faturaAdresi,
      teslimatAdresi: teslimatAdresi,
      kalemlerJson: quote.kalemlerJson,
      satisTemsilcisi: req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi,
      notlar: notesCombined
    }, req.user, req.ip);

    await quotationRepository.updateStatus(id, 'Converted', 'Siparişe dönüştürüldü', req.user, req.ip);
    res.redirect('/sales/orders');
  });

  // 2b. MÜŞTERİ ÖZEL FİYAT LİSTELERİ & DÖVİZ KURLARI
  listPriceLists = asyncHandler(async (req, res) => {
    const rawPriceLists = await priceListRepository.findAll();
    const customers = await customerRepository.findAll({ status: 'Active' });
    const stockItems = await StokKarti.findAll({ where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } }, order: [['ad', 'ASC']] });

    const groupsMap = new Map();

    rawPriceLists.forEach(item => {
      const custId = item.musteriId || item.customerId || 0;
      const custObj = item.musteri || item.customer;
      const custName = custObj ? (custObj.firmaAdi || custObj.companyName) : 'Tüm Müşteriler (Genel İskonto)';
      const custCode = custObj ? (custObj.musteriKodu || custObj.customerCode) : 'GENEL-000';

      if (!groupsMap.has(custId)) {
        groupsMap.set(custId, {
          customerId: custId,
          customerName: custName,
          customerCode: custCode,
          customer: custObj,
          listName: item.listeAdi || item.listName || 'Özel Fiyat Listesi',
          validFrom: item.gecerlilikBaslangic || item.validFrom,
          validUntil: item.gecerlilikBitis || item.validUntil,
          items: []
        });
      }

      const st = item.stokKarti || item.stockItem;
      const stockCode = st ? (st.stokKodu || st.stockCode || 'STK') : 'STK';
      const stockName = st ? (st.ad || st.name || 'Stok Ürünü') : 'Stok Ürünü';
      const salePrice = st ? parseFloat(st.satisFiyati || st.salePrice || 0) : 0;
      const specialPrice = parseFloat(item.ozelFiyat !== undefined ? item.ozelFiyat : item.specialPrice) || 0;
      const customDiscountRate = parseFloat(item.ozelIskontoOrani !== undefined ? item.ozelIskontoOrani : item.customDiscountRate) || 0;
      const currency = item.paraBirimi || item.currency || 'TRY';

      groupsMap.get(custId).items.push({
        id: item.id,
        stockId: item.stokId || item.stockId,
        stockItemId: item.stokId || item.stockId,
        stockCode,
        stockName,
        salePrice,
        specialPrice,
        customDiscountRate,
        currency,
        ozelFiyat: specialPrice,
        ozelIskontoOrani: customDiscountRate,
        paraBirimi: currency,
        gecerlilikBaslangic: item.gecerlilikBaslangic || item.validFrom,
        gecerlilikBitis: item.gecerlilikBitis || item.validUntil,
        validFrom: item.gecerlilikBaslangic || item.validFrom,
        validUntil: item.gecerlilikBitis || item.validUntil,
        stokKarti: st,
        stockItem: {
          id: st ? st.id : null,
          stokKodu: stockCode,
          stockCode: stockCode,
          ad: stockName,
          name: stockName,
          satisFiyati: salePrice,
          salePrice: salePrice
        }
      });
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

  renderAddPriceList = asyncHandler(async (req, res) => {
    const customers = await customerRepository.findAll({ status: 'Active' });
    const stockItems = await StokKarti.findAll({
      where: { durum: 'Active', kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['ad', 'ASC']]
    });

    res.render('sales/price_lists_add', {
      user: req.user,
      customers,
      stockItems,
      error: req.query.error || null,
      success: null
    });
  });

  addPriceList = asyncHandler(async (req, res) => {
    try {
      const listName = req.body.listeAdi || req.body.listName || 'Müşteri Özel Fiyat Listesi';
      const customerId = req.body.musteriId || req.body.customerId ? parseInt(req.body.musteriId || req.body.customerId, 10) : null;
      const validFrom = req.body.gecerlilikBaslangic || req.body.validFrom || null;
      const validUntil = req.body.gecerlilikBitis || req.body.validUntil || null;
      const notes = req.body.notlar || req.body.notes || null;

      const todayStr = new Date().toISOString().split('T')[0];
      if (validFrom && validFrom < todayStr) {
        throw new Error('⚠️ Geçerlilik başlangıç tarihi bugünden eski bir tarih olamaz!');
      }

      let itemsToProcess = [];

      const rawItemsJson = req.body.itemsJson || req.body.kalemlerJson;
      if (rawItemsJson) {
        try { itemsToProcess = JSON.parse(rawItemsJson); } catch (e) { itemsToProcess = []; }
      }

      if (!Array.isArray(itemsToProcess) || itemsToProcess.length === 0) {
        const sId = parseInt(req.body.stokId || req.body.stockItemId, 10);
        if (sId) {
          itemsToProcess = [{
            stokId: sId,
            ozelFiyat: parseFloat(req.body.ozelFiyat || req.body.specialPrice) || 0,
            ozelIskontoOrani: parseFloat(req.body.ozelIskontoOrani || req.body.customDiscountRate) || 0,
            paraBirimi: req.body.paraBirimi || req.body.currency || 'TRY'
          }];
        }
      }

      if (itemsToProcess.length === 0) {
        throw new Error('Lütfen özel fiyat tanımlanacak en az 1 adet ürün ekleyiniz.');
      }

      for (const it of itemsToProcess) {
        const stockItemId = parseInt(it.stokId || it.stockItemId, 10);
        if (!stockItemId) continue;

        const stockItem = await StokKarti.findByPk(stockItemId);
        if (!stockItem) continue;

        const specPrice = parseFloat(it.ozelFiyat !== undefined ? it.ozelFiyat : it.specialPrice) || 0;
        const stdPrice = parseFloat(stockItem.satisFiyati) || 0;

        if (specPrice > stdPrice) {
          throw new Error(`⚠️ [${stockItem.stokKodu}] ${stockItem.ad} ürünü için girilen özel fiyat (${specPrice.toLocaleString('tr-TR')} TL), ürünün standart liste satış fiyatından (${stdPrice.toLocaleString('tr-TR')} TL) daha yüksek olamaz!`);
        }

        const discRate = parseFloat(it.ozelIskontoOrani !== undefined ? it.ozelIskontoOrani : it.customDiscountRate) || 0;
        const curr = it.paraBirimi || it.currency || 'TRY';

        const existing = await MusteriFiyatListesi.findOne({
          where: {
            musteriId: customerId,
            stokId: stockItemId
          }
        });

        if (existing) {
          await existing.update({
            listeAdi: listName,
            ozelFiyat: specPrice,
            ozelIskontoOrani: discRate,
            paraBirimi: curr,
            gecerlilikBaslangic: validFrom,
            gecerlilikBitis: validUntil,
            notlar: notes,
            durum: 'Active'
          });
        } else {
          await priceListRepository.create({
            listeAdi: listName,
            musteriId: customerId,
            stokId: stockItemId,
            ozelFiyat: specPrice,
            ozelIskontoOrani: discRate,
            paraBirimi: curr,
            gecerlilikBaslangic: validFrom,
            gecerlilikBitis: validUntil,
            notlar: notes,
            durum: 'Active'
          }, req.user);
        }
      }

      res.redirect('/sales/price-lists?success=' + encodeURIComponent('✅ Müşteri özel fiyat listesi başarıyla kaydedildi.'));
    } catch (err) {
      res.redirect('/sales/price-lists/add?error=' + encodeURIComponent(err.message || 'Fiyat listesi kaydı oluşturulurken hata oluştu.'));
    }
  });

  deleteCustomerPriceLists = asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const targetCustId = customerId === '0' || customerId === 'null' ? null : parseInt(customerId, 10);

    await MusteriFiyatListesi.destroy({ where: { musteriId: targetCustId } });
    res.redirect('/sales/price-lists?success=' + encodeURIComponent('✅ Seçilen müşteriye ait özel fiyat tanımları silindi.'));
  });

  deletePriceListItem = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await MusteriFiyatListesi.destroy({ where: { id: parseInt(id, 10) } });
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
        musteriKodu: req.body.musteriKodu || req.body.customerCode,
        firmaAdi: req.body.firmaAdi || req.body.companyName,
        vergiDairesi: req.body.vergiDairesi || req.body.taxOffice || null,
        vergiNo: req.body.vergiNo || req.body.taxNo || null,
        ilgiliKisi: req.body.ilgiliKisi || req.body.contactPerson || null,
        eposta: req.body.eposta || req.body.email || null,
        telefon: req.body.telefon || req.body.phone || null,
        adres: req.body.adres || req.body.address || null,
        sehir: req.body.sehir || req.body.city || null,
        krediLimiti: parseFloat(req.body.krediLimiti || req.body.creditLimit) || 100000.00,
        vadeGunu: parseInt(req.body.vadeGunu || req.body.paymentTermDays, 10) || 30,
        riskSeviyesi: req.body.riskSeviyesi || req.body.riskLevel || 'Low',
        durum: 'Active',
        notlar: req.body.notlar || req.body.notes || null
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
    const orders = await SatisSiparisi.findAll({ where: { musteriId: id }, order: [['createdAt', 'DESC']] });
    const quotes = await SatisTeklifi.findAll({ where: { musteriId: id }, order: [['createdAt', 'DESC']] });
    const invoices = await SatisFaturasi.findAll({ where: { musteriId: id }, order: [['createdAt', 'DESC']] });

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
      const type = req.body.islemTuru || req.body.type;
      const amount = parseFloat(req.body.tutar || req.body.amount) || 0;

      await customerLedgerRepository.addEntry({
        musteriId: parseInt(id, 10),
        islemTarihi: req.body.islemTarihi || req.body.transactionDate || new Date().toISOString().split('T')[0],
        belgeNo: req.body.belgeNo || req.body.documentNo || `ISL-${Date.now().toString().slice(-6)}`,
        aciklama: req.body.aciklama || req.body.description || 'Tahsilat / Manuel Cari İşlem',
        borcTutari: type === 'Debit' || type === 'Borc' ? amount : 0,
        alacakTutari: type === 'Credit' || type === 'Alacak' ? amount : 0,
        paraBirimi: req.body.paraBirimi || req.body.currency || 'TRY'
      }, req.user);

      res.redirect(`/sales/customers/${id}`);
    } catch (err) {
      res.redirect(`/sales/customers/${id}`);
    }
  });

  async getOpenOrdersWithDispatchedMap() {
    const openOrders = await SatisSiparisi.findAll({
      where: { durum: { [Op.ne]: 'Completed' } },
      include: [{ model: StokKarti, as: 'stokKarti' }],
      order: [['createdAt', 'DESC']]
    });

    const openOrdersData = [];
    for (const order of openOrders) {
      const orderPlain = order.get({ plain: true });

      const existingDispatches = await SatisIrsaliyesi.findAll({
        where: { satisSiparisId: order.id }
      });

      const dispatchedQtyMap = {};
      for (const d of existingDispatches) {
        const rawJson = d.kalemlerJson || d.itemsJson;
        if (rawJson) {
          try {
            const dItems = typeof rawJson === 'string' ? JSON.parse(rawJson) : rawJson;
            if (Array.isArray(dItems)) {
              dItems.forEach(it => {
                const sId = String(it.stokId || it.stockItemId || order.stokId || '');
                const q = parseFloat(it.sevkMiktari || it.dispatchQuantity || it.miktar || it.quantity || 0);
                dispatchedQtyMap[sId] = (dispatchedQtyMap[sId] || 0) + q;
              });
            }
          } catch (e) { }
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
      saleOrderId, satisSiparisId, dispatchType, irsaliyeTuru, shipmentDate, sevkTarihi, exitWarehouse, cikisDeposu, deliveryCity, teslimSehri,
      deliveryDistrict, teslimIlcesi, recipientPerson, aliciKisi, deliveryType, teslimTuru, projectNo, projeNo, carrierCompany, tasiyiciFirma,
      vehiclePlate, aracPlakasi, driverName, surucuAdi, notes, notlar, itemsJson, kalemlerJson
    } = req.body;

    const targetOrderId = satisSiparisId || saleOrderId;
    const order = await SatisSiparisi.findByPk(targetOrderId, {
      include: [{ model: StokKarti, as: 'stokKarti' }]
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

    if (order.durum === 'Completed') {
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

    let parsedItems = [];
    const rawItemsJson = kalemlerJson || itemsJson;
    if (rawItemsJson) {
      try {
        parsedItems = typeof rawItemsJson === 'string' ? JSON.parse(rawItemsJson) : rawItemsJson;
      } catch (e) {
        parsedItems = [];
      }
    }

    if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
      const orderItemsJson = order.kalemlerJson || order.itemsJson;
      if (orderItemsJson) {
        try { parsedItems = JSON.parse(orderItemsJson); } catch (e) { parsedItems = []; }
      }
      if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
        parsedItems = [{
          stokId: order.stokId,
          stokKodu: order.stokKarti ? order.stokKarti.stokKodu : '',
          ad: order.stokKarti ? order.stokKarti.ad : 'Ürün Kalemi',
          siparisMiktari: order.miktar,
          sevkMiktari: order.miktar,
          birimFiyat: order.birimFiyat
        }];
      } else {
        parsedItems = parsedItems.map(it => ({
          ...it,
          siparisMiktari: parseFloat(it.miktar || it.quantity) || 1,
          sevkMiktari: parseFloat(it.miktar || it.quantity) || 1
        }));
      }
    }

    const existingDispatches = await SatisIrsaliyesi.findAll({
      where: { satisSiparisId: order.id }
    });

    const dispatchedQtyMap = {};
    for (const d of existingDispatches) {
      const dJson = d.kalemlerJson || d.itemsJson;
      if (dJson) {
        try {
          const dItems = typeof dJson === 'string' ? JSON.parse(dJson) : dJson;
          if (Array.isArray(dItems)) {
            dItems.forEach(it => {
              const sId = String(it.stokId || it.stockItemId || order.stokId || '');
              const q = parseFloat(it.sevkMiktari || it.dispatchQuantity || it.miktar || it.quantity || 0);
              dispatchedQtyMap[sId] = (dispatchedQtyMap[sId] || 0) + q;
            });
          }
        } catch (e) { }
      }
    }

    let totalDispatchedQty = 0;

    for (const item of parsedItems) {
      const sIdKey = String(item.stokId || item.stockItemId || order.stokId || '');
      const orderedQty = parseFloat(item.siparisMiktari || item.orderedQuantity || item.miktar || item.quantity) || 0;
      const alreadyDispatched = dispatchedQtyMap[sIdKey] || 0;
      const remainingQty = Math.max(0, orderedQty - alreadyDispatched);
      const dispatchQty = parseFloat(item.sevkMiktari !== undefined ? item.sevkMiktari : item.dispatchQuantity);

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
          error: `⚠️ HATA: "${item.ad || item.name || 'Ürün'}" için sevk miktarı negatif olamaz!`
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
          error: `⚠️ HATA: "${item.ad || item.name || 'Ürün'}" için sevk edilecek miktar (${dispatchQty} Adet), kalan sevk edilebilir miktarı (${remainingQty} Adet) geçemez!`
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
      irsaliyeNo: nextDispatchNo,
      irsaliyeTuru: irsaliyeTuru || dispatchType || 'Satış İrsaliyesi',
      satisSiparisId: order.id,
      musteriId: order.musteriId,
      musteriAdi: order.musteriAdi,
      irsaliyeTarihi: new Date().toISOString().split('T')[0],
      sevkTarihi: sevkTarihi || shipmentDate || new Date().toISOString().split('T')[0],
      cikisDeposu: cikisDeposu || exitWarehouse || 'Merkez Lojistik Deposu',
      tasiyiciFirma: tasiyiciFirma || carrierCompany || null,
      aracPlakasi: aracPlakasi || vehiclePlate || null,
      surucuAdi: surucuAdi || driverName || null,
      takipNo: nextTrackingNo,
      teslimatAdresi: order.teslimatAdresi || null,
      teslimSehri: teslimSehri || deliveryCity || null,
      teslimIlcesi: teslimIlcesi || deliveryDistrict || null,
      aliciKisi: aliciKisi || recipientPerson || null,
      teslimTuru: teslimTuru || deliveryType || null,
      projeNo: projeNo || projectNo || null,
      durum: 'Dispatched',
      notlar: notlar || notes || null,
      kalemlerJson: JSON.stringify(parsedItems)
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

    const existingInvoices = await SatisFaturasi.findAll({
      attributes: ['satisSiparisId'],
      where: { satisSiparisId: { [Op.ne]: null } }
    });
    const invoicedOrderIds = existingInvoices.map(inv => inv.satisSiparisId).filter(id => !!id);

    const completedOrders = await SatisSiparisi.findAll({
      where: {
        durum: 'Completed',
        id: { [Op.notIn]: invoicedOrderIds.length > 0 ? invoicedOrderIds : [0] }
      },
      include: [{ model: StokKarti, as: 'stokKarti' }],
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
    const order = await SatisSiparisi.findByPk(id, {
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: MusteriHesabi, as: 'musteri' }
      ]
    });

    if (!order) {
      return res.redirect('/sales/invoices?error=' + encodeURIComponent('⚠️ Sipariş kaydı bulunamadı.'));
    }

    if (order.durum !== 'Completed') {
      return res.redirect('/sales/invoices?error=' + encodeURIComponent('⚠️ Yalnızca teslimatı tamamlanmış (Tamamlandı durumundaki) siparişler için satış faturası kesilebilir.'));
    }

    const existingInvoice = await SatisFaturasi.findOne({ where: { satisSiparisId: order.id } });
    if (existingInvoice) {
      return res.redirect('/sales/invoices?error=' + encodeURIComponent(`⚠️ Bu sipariş (${order.siparisNo}) için daha önce ${existingInvoice.faturaNo} numaralı satış faturası kesilmiştir! Tekrar fatura oluşturulamaz.`));
    }

    const dispatchNote = await SatisIrsaliyesi.findOne({ where: { satisSiparisId: order.id } });

    const nextInvoiceNo = await invoiceRepository.getNextInvoiceNo();

    const invoiceScenario = req.body.faturaSenaryosu || req.body.invoiceScenario || 'EARSIVFATURA';
    const invoiceType = req.body.faturaTuru || req.body.invoiceType || 'SATIS';
    const paymentType = req.body.odemeTuru || req.body.paymentType || order.odemeVadesi || 'Vadeli';
    const paymentTermDays = parseInt(req.body.vadeGunu || req.body.paymentTermDays, 10) || 30;

    const invoiceDate = req.body.faturaTarihi || req.body.invoiceDate || new Date().toISOString().split('T')[0];
    const now = new Date();
    const invoiceTime = req.body.faturaSaati || req.body.invoiceTime || `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;

    const dueDateObj = new Date(invoiceDate);
    dueDateObj.setDate(dueDateObj.getDate() + paymentTermDays);
    const dueDate = req.body.vadeTarihi || req.body.dueDate || dueDateObj.toISOString().split('T')[0];

    const bankName = req.body.bankaAdi || req.body.bankName || 'Ziraat Bankası A.Ş. - Maslak Ticari Şubesi';
    const ibanNo = req.body.ibanNo || 'TR56 0001 0002 0003 0004 0005 06';
    const ettnNo = req.body.ettnNo || require('crypto').randomUUID();

    let itemsJsonStr = order.kalemlerJson || order.itemsJson;
    if (!itemsJsonStr) {
      itemsJsonStr = JSON.stringify([{
        stokId: order.stokId,
        stokKodu: order.stokKarti ? order.stokKarti.stokKodu : 'STK-001',
        ad: order.stokKarti ? order.stokKarti.ad : 'Ürün Kalemi',
        miktar: parseFloat(order.miktar) || 1,
        birim: order.stokKarti ? order.stokKarti.birim : 'Adet',
        birimFiyat: parseFloat(order.birimFiyat) || 0,
        iskontoOrani: parseFloat(order.iskontoOrani) || 0,
        iskontoTutari: parseFloat(order.iskontoTutari) || 0,
        kdvOrani: parseFloat(order.kdvOrani) || 20,
        kdvTutari: parseFloat(order.kdvTutari) || 0,
        toplamTutar: parseFloat(order.toplamTutar) || 0
      }]);
    }

    const invoice = await invoiceRepository.create({
      faturaNo: nextInvoiceNo,
      satisSiparisId: order.id,
      satisIrsaliyeId: dispatchNote ? dispatchNote.id : null,
      musteriId: order.musteriId,
      musteriAdi: order.musteriAdi,
      musteriVergiNo: order.musteriVergiNo || (order.musteri ? order.musteri.vergiNo : '1234567890'),
      musteriVergiDairesi: order.musteri ? order.musteri.vergiDairesi : 'Maslak V.D.',
      faturaAdresi: order.faturaAdresi || (order.musteri ? order.musteri.adres : 'Maslak Mah. Büyükdere Cad. No:100 Şişli / İstanbul'),
      teslimatAdresi: order.teslimatAdresi || (order.musteri ? order.musteri.adres : 'Maslak Mah. Büyükdere Cad. No:100 Şişli / İstanbul'),
      musteriTelefon: order.musteriTelefon || (order.musteri ? order.musteri.telefon : '+90 212 555 0100'),
      musteriEposta: order.musteriEposta || (order.musteri ? order.musteri.eposta : 'bilgi@musteri.com'),
      faturaTarihi: invoiceDate,
      faturaSaati: invoiceTime,
      vadeTarihi: dueDate,
      faturaTuru: invoiceType,
      faturaSenaryosu: invoiceScenario,
      ettnNo: ettnNo,
      siparisNo: order.siparisNo,
      siparisTarihi: order.siparisTarihi,
      irsaliyeNo: dispatchNote ? dispatchNote.irsaliyeNo : null,
      irsaliyeTarihi: dispatchNote ? dispatchNote.irsaliyeTarihi : null,
      araToplam: order.araToplam,
      iskontoTutari: order.iskontoTutari,
      kdvTutari: order.kdvTutari,
      toplamTutar: order.toplamTutar,
      paraBirimi: order.paraBirimi || 'TRY',
      dovizKuru: parseFloat(req.body.dovizKuru || req.body.exchangeRate) || 1.0000,
      odemeTuru: paymentType,
      vadeGunu: paymentTermDays,
      bankaAdi: bankName,
      ibanNo: ibanNo,
      odemeDurumu: 'Unpaid',
      durum: 'Issued',
      kalemlerJson: itemsJsonStr,
      notlar: req.body.notlar || req.body.notes || `[Sipariş No: ${order.siparisNo}] numaralı tamamlanan satış siparişi faturaya dönüştürüldü.`
    }, req.user, req.ip);

    if (order.musteriId) {
      await customerLedgerRepository.addEntry({
        musteriId: order.musteriId,
        islemTarihi: invoice.faturaTarihi,
        islemTuru: 'Sale_Invoice',
        belgeNo: invoice.faturaNo,
        aciklama: `[Satış Faturası] ${invoice.faturaNo} no'lu fatura kaydı`,
        borcTutari: invoice.toplamTutar,
        alacakTutari: 0,
        paraBirimi: invoice.paraBirimi
      }, req.user);
    }

    res.redirect('/sales/invoices?success=' + encodeURIComponent(`✅ ${invoice.faturaNo} numaralı satış faturası başarıyla oluşturuldu ve cari borç bakiyesine işlendi.`));
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
    const pendingQuotes = await SatisTeklifi.findAll({
      where: { durum: 'Pending_Approval' },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });
    const pendingOrders = await SatisSiparisi.findAll({
      where: { durum: 'Pending_Approval' },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });

    res.render('sales/approvals', {
      user: req.user,
      pendingQuotes,
      pendingOrders
    });
  });

  approveOrderOrQuote = asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { action, managerNotes, yoneticiNotlari } = req.body;
    const noteVal = yoneticiNotlari || managerNotes;

    if (type === 'quote') {
      const status = action === 'approve' ? 'Approved' : 'Rejected';
      await quotationRepository.updateStatus(id, status, noteVal, req.user, req.ip);
    } else if (type === 'order') {
      const status = action === 'approve' ? 'Approved' : 'Rejected';
      await saleService.updateOrder(id, { durum: status, yoneticiNotlari: noteVal }, req.user, req.ip);
    }

    res.redirect('/sales/approvals');
  });

  // 7. SATIŞ ANALİTİĞİ DASHBOARD
  showAnalytics = asyncHandler(async (req, res) => {
    let totalOrders = 0, completedOrders = 0, pendingOrders = 0, totalRevenue = 0;
    try {
      totalOrders = (await SatisSiparisi.count()) || 0;
      completedOrders = (await SatisSiparisi.count({ where: { durum: 'Completed' } })) || 0;
      pendingOrders = (await SatisSiparisi.count({ where: { durum: 'Pending_Approval' } })) || 0;
      const revenueResult = await SatisSiparisi.sum('toplamTutar', { where: { durum: { [Op.ne]: 'Cancelled' } } });
      totalRevenue = parseFloat(revenueResult || 0);
    } catch (e) {
      console.error('Analytics count error:', e);
    }

    let salesRepData = [];
    try {
      salesRepData = await SatisSiparisi.findAll({
        attributes: [
          'satisTemsilcisi',
          [fn('SUM', col('toplamTutar')), 'totalRevenue'],
          [fn('COUNT', col('id')), 'orderCount']
        ],
        where: { durum: { [Op.ne]: 'Cancelled' } },
        group: ['satisTemsilcisi'],
        raw: true
      });
    } catch (e) {
      console.error('Analytics salesRepData error:', e);
    }

    let ordersWithItems = [];
    try {
      ordersWithItems = await SatisSiparisi.findAll({
        where: { durum: { [Op.ne]: 'Cancelled' } },
        include: [{ model: StokKarti, as: 'stokKarti' }]
      });
    } catch (e) {
      console.error('Analytics ordersWithItems error:', e);
    }

    let totalCost = 0;
    const productStatsMap = {};

    ordersWithItems.forEach(o => {
      const purchasePrice = o.stokKarti ? parseFloat(o.stokKarti.alisFiyati || 0) : 0;
      const qty = parseFloat(o.miktar || 0);
      const orderCost = qty * purchasePrice;
      totalCost += orderCost;

      const itemName = o.stokKarti ? o.stokKarti.ad : 'Diğer Ürün';
      if (!productStatsMap[itemName]) {
        productStatsMap[itemName] = { quantity: 0, revenue: 0 };
      }
      productStatsMap[itemName].quantity += qty;
      productStatsMap[itemName].revenue += parseFloat(o.toplamTutar || 0);
    });

    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

    const topProducts = Object.keys(productStatsMap)
      .map(name => ({ name, ...productStatsMap[name] }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    let recentOrders = [];
    try {
      recentOrders = await SatisSiparisi.findAll({
        include: [{ model: StokKarti, as: 'stokKarti' }],
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
    const customerId = req.query.customerId || req.query.musteriId;
    const stockItemId = req.query.stockItemId || req.query.stokId;
    let specialPrice = null;
    let customDiscountRate = 0;
    let currency = 'TRY';

    if (customerId && stockItemId) {
      const pList = await priceListRepository.findCustomerSpecialPrice(customerId, stockItemId);
      if (pList) {
        specialPrice = pList.ozelFiyat !== undefined ? pList.ozelFiyat : pList.specialPrice;
        customDiscountRate = pList.ozelIskontoOrani !== undefined ? pList.ozelIskontoOrani : pList.customDiscountRate;
        currency = pList.paraBirimi || pList.currency || 'TRY';
      }
    }

    const stockItem = stockItemId ? await StokKarti.findByPk(stockItemId) : null;

    res.json({
      success: true,
      hasSpecialPrice: specialPrice !== null,
      specialPrice: specialPrice !== null ? parseFloat(specialPrice) : (stockItem ? parseFloat(stockItem.satisFiyati) : 0),
      standardPrice: stockItem ? parseFloat(stockItem.satisFiyati) : 0,
      customDiscountRate: parseFloat(customDiscountRate),
      currency: currency || 'TRY'
    });
  });

  apiGetStockInfo = asyncHandler(async (req, res) => {
    const stockItemId = req.params.stockItemId || req.params.stokId;
    const item = await StokKarti.findByPk(stockItemId);

    if (!item) {
      return res.status(404).json({ success: false, message: 'Stok kartı bulunamadı.' });
    }

    res.json({
      success: true,
      id: item.id,
      stokKodu: item.stokKodu,
      stockCode: item.stokKodu,
      ad: item.ad,
      name: item.ad,
      birim: item.birim,
      unit: item.birim,
      mevcutStok: parseFloat(item.mevcutStok),
      currentStock: parseFloat(item.mevcutStok),
      asgariStok: parseFloat(item.asgariStok || 0),
      minStockLevel: parseFloat(item.asgariStok || 0),
      satisFiyati: parseFloat(item.satisFiyati),
      salePrice: parseFloat(item.satisFiyati),
      kdvOrani: parseFloat(item.kdvOrani || 20),
      vatRate: parseFloat(item.kdvOrani || 20),
      isLowStock: parseFloat(item.mevcutStok) <= parseFloat(item.asgariStok || 0)
    });
  });
}

module.exports = new SaleController();
