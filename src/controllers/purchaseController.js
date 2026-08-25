const purchaseInvoiceRepository = require('../repositories/purchaseInvoiceRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('../services/purchaseService');
const stockService = require('../services/stockService');
const requisitionRepository = require('../repositories/requisitionRepository');
const supplierRepository = require('../repositories/supplierRepository');
const rfqRepository = require('../repositories/rfqRepository');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const asyncHandler = require('../utils/asyncHandler');
const { StokKarti, SatinAlmaSiparisi, Tedarikci, SatinAlmaTalebi, SatinAlmaTeklifTalebi, SatinAlmaFaturasi, MalKabul, Depo } = require('../../models');
const { Op } = require('sequelize');

class PurchaseController {
  // ═══════════════════════ ANALYTICS DASHBOARD ═══════════════════════
  showAnalytics = asyncHandler(async (req, res) => {
    const data = await purchaseService.getAnalyticsData();
    res.render('purchase/analytics', {
      user: req.user,
      ...data
    });
  });

  // ═══════════════════════ PURCHASE ORDERS ═══════════════════════
  listOrders = asyncHandler(async (req, res) => {
    const { search, status, paymentTerm } = req.query;
    const orders = await purchaseService.getAllOrders({ search, status, paymentTerm });
    const stats = await purchaseService.getStats();

    let successMsg = null;
    if (req.query.success === 'created') {
      const orderNo = req.query.orderNo ? req.query.orderNo : '';
      successMsg = `✅ Satın Alma Siparişi ${orderNo ? '(' + orderNo + ') ' : ''}teklif onaylanarak otomatik olarak başarıyla oluşturuldu ve siparişler listesine eklendi.`;
    }

    res.render('purchase/list', {
      user: req.user,
      orders,
      stats,
      filterSearch: search || '',
      filterStatus: status || '',
      filterPaymentTerm: paymentTerm || '',
      successMsg
    });
  });

  renderAddOrder = asyncHandler(async (req, res) => {
    if (req.query.rfqId) {
      const newOrder = await purchaseService.acceptRfq(req.query.rfqId, req.user, req.ip);
      const orderNo = newOrder ? (newOrder.siparisNo || newOrder.orderNo) : '';
      return res.redirect(`/purchase/orders?success=created&orderNo=${encodeURIComponent(orderNo)}`);
    }
    return res.redirect('/purchase/orders');
  });

  addOrder = asyncHandler(async (req, res) => {
    const rfqId = req.body.rfqId || req.query.rfqId;
    if (rfqId) {
      const newOrder = await purchaseService.acceptRfq(rfqId, req.user, req.ip);
      const orderNo = newOrder ? (newOrder.siparisNo || newOrder.orderNo) : '';
      return res.redirect(`/purchase/orders?success=created&orderNo=${encodeURIComponent(orderNo)}`);
    }
    return res.redirect('/purchase/orders');
  });

  renderEditOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await purchaseService.getOrderById(id);
    const stockItems = await StokKarti.findAll({
      where: { durum: 'Active' },
      order: [['ad', 'ASC']]
    });
    const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });
    const warehouses = await Depo.findAll({
      where: { durum: 'Active' },
      order: [['ad', 'ASC']]
    });

    let itemsList = [];
    const itemsJson = order.kalemlerJson || order.itemsJson;
    if (itemsJson) {
      try { itemsList = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson; } catch (e) { itemsList = []; }
    }
    if (!Array.isArray(itemsList) || itemsList.length === 0) {
      itemsList = [{
        stokId: order.stokId,
        stokKodu: order.stokKarti ? order.stokKarti.stokKodu : '',
        ad: order.stokKarti ? order.stokKarti.ad : 'Ürün Kalemi',
        miktar: order.miktar,
        birim: order.stokKarti ? order.stokKarti.birim : 'Adet',
        birimFiyat: order.birimFiyat,
        iskontoOrani: order.iskontoOrani || 0,
        kdvOrani: order.kdvOrani || 20,
        araToplam: order.araToplam,
        toplamTutar: order.toplamTutar
      }];
    }

    res.render('purchase/edit', {
      user: req.user,
      order,
      itemsList,
      stockItems,
      suppliers,
      warehouses,
      error: null
    });
  });

  editOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    try {
      const quantity = parseFloat(req.body.miktar !== undefined ? req.body.miktar : req.body.quantity) || 1;
      const unitPrice = parseFloat(req.body.birimFiyat !== undefined ? req.body.birimFiyat : req.body.unitPrice) || 0;
      const discountRate = parseFloat(req.body.iskontoOrani !== undefined ? req.body.iskontoOrani : req.body.discountRate) || 0;
      const taxRate = parseFloat(req.body.kdvOrani !== undefined ? req.body.kdvOrani : req.body.taxRate) || 20;

      const subtotal = quantity * unitPrice;
      const discountAmount = subtotal * (discountRate / 100);
      const afterDiscount = subtotal - discountAmount;
      const taxAmount = afterDiscount * (taxRate / 100);
      const totalAmount = afterDiscount + taxAmount;

      await purchaseService.updateOrder(id, {
        tedarikciAdi: req.body.tedarikciAdi ? req.body.tedarikciAdi.trim() : (req.body.supplierName ? req.body.supplierName.trim() : ''),
        tedarikciId: req.body.tedarikciId ? parseInt(req.body.tedarikciId, 10) : (req.body.supplierId ? parseInt(req.body.supplierId, 10) : null),
        tedarikciVergiNo: req.body.tedarikciVergiNo || req.body.supplierTaxNo || null,
        tedarikciIlgiliKisi: req.body.tedarikciIlgiliKisi || req.body.supplierContactPerson || null,
        tedarikciEposta: req.body.tedarikciEposta || req.body.supplierEmail || null,
        tedarikciTelefon: req.body.tedarikciTelefon || req.body.supplierPhone || null,
        siparisTarihi: req.body.siparisTarihi || req.body.orderDate,
        beklenenTeslimTarihi: req.body.beklenenTeslimTarihi || req.body.expectedDeliveryDate || null,
        odemeVadesi: req.body.odemeVadesi || req.body.paymentTerm,
        durum: req.body.durum || req.body.status,
        oncelik: req.body.oncelik || req.body.priority,
        teslimDeposu: req.body.teslimDeposu ? req.body.teslimDeposu.trim() : (req.body.deliveryWarehouse ? req.body.deliveryWarehouse.trim() : null),
        stokId: parseInt(req.body.stokId || req.body.stockItemId, 10),
        miktar: quantity,
        birimFiyat: unitPrice,
        iskontoOrani: discountRate,
        kdvOrani: taxRate,
        araToplam: subtotal,
        iskontoTutari: discountAmount,
        kdvTutari: taxAmount,
        toplamTutar: totalAmount,
        paraBirimi: req.body.paraBirimi || req.body.currency || 'TRY',
        notlar: req.body.notlar || req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/orders');
    } catch (err) {
      const order = await purchaseService.getOrderById(id);
      const stockItems = await StokKarti.findAll({ where: { durum: 'Active' }, order: [['ad', 'ASC']] });
      const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });
      const warehouses = await Depo.findAll({ where: { durum: 'Active' }, order: [['ad', 'ASC']] });

      res.render('purchase/edit', {
        user: req.user,
        order,
        stockItems,
        suppliers,
        warehouses,
        error: err.message || 'Sipariş güncellenirken hata oluştu.'
      });
    }
  });

  viewOrderDetail = asyncHandler(async (req, res) => {
    return res.redirect(`/purchase/orders/${req.params.id}/edit`);
  });

  // ═══════════════════════ REQUISITIONS ═══════════════════════
  listRequisitions = asyncHandler(async (req, res) => {
    const { search, status, sourceModule } = req.query;
    const requisitions = await purchaseService.getAllRequisitions({ status, sourceModule });

    const acceptedRfqs = await SatinAlmaTeklifTalebi.findAll({
      where: { durum: 'Accepted' }
    });
    const acceptedStockItemIds = new Set();
    acceptedRfqs.forEach(rfq => {
      const items = (rfq.kalemlerVerisi && Array.isArray(rfq.kalemlerVerisi)) ? rfq.kalemlerVerisi : [];
      items.forEach(item => {
        if (item.stokId || item.stockItemId) acceptedStockItemIds.add(parseInt(item.stokId || item.stockItemId, 10));
      });
      if (items.length === 0 && rfq.stokId) {
        acceptedStockItemIds.add(parseInt(rfq.stokId, 10));
      }
    });

    res.render('purchase/requisitions', {
      user: req.user,
      requisitions,
      acceptedStockItemIds: Array.from(acceptedStockItemIds),
      filterSearch: search || '',
      filterStatus: status || '',
      filterSourceModule: sourceModule || ''
    });
  });

  renderAddRequisition = asyncHandler(async (req, res) => {
    const nextReqNo = await purchaseService.getNextRequisitionNo();
    const stockItems = await StokKarti.findAll({
      where: { durum: 'Active' },
      order: [['ad', 'ASC']]
    });

    res.render('purchase/requisition_add', {
      user: req.user,
      error: null,
      nextReqNo,
      stockItems,
      formData: {}
    });
  });

  addRequisition = asyncHandler(async (req, res) => {
    try {
      await purchaseService.createRequisition({
        talepNo: req.body.talepNo || req.body.requisitionNo,
        kaynakModul: req.body.kaynakModul || req.body.sourceModule || 'Manual',
        stokId: parseInt(req.body.stokId || req.body.stockItemId, 10),
        talepEdilenMiktar: parseFloat(req.body.talepEdilenMiktar !== undefined ? req.body.talepEdilenMiktar : req.body.requestedQuantity) || 1,
        birim: req.body.birim || req.body.unit || 'Adet',
        aciliyet: req.body.aciliyet || req.body.urgency || 'Normal',
        durum: 'Pending',
        talepEdenAdi: req.body.talepEdenAdi || req.body.requesterName || (req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi),
        notlar: req.body.notlar || req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/requisitions');
    } catch (err) {
      const nextReqNo = await purchaseService.getNextRequisitionNo();
      const stockItems = await StokKarti.findAll({ where: { durum: 'Active' }, order: [['ad', 'ASC']] });

      res.render('purchase/requisition_add', {
        user: req.user,
        error: err.message || 'Talep oluşturulurken hata oluştu.',
        nextReqNo,
        stockItems,
        formData: req.body
      });
    }
  });

  convertRequisition = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const requisitions = await requisitionRepository.findAll();
    const reqItem = requisitions.find(r => r.id === parseInt(id, 10));

    if (reqItem) {
      const nextOrderNo = await purchaseService.getNextOrderNo();
      const stockItem = reqItem.stokKarti;

      await purchaseService.createOrder({
        siparisNo: nextOrderNo,
        tedarikciAdi: stockItem ? (stockItem.tedarikci || 'Ana Tedarikçi A.Ş.') : 'Genel Tedarikçi A.Ş.',
        siparisTarihi: new Date().toISOString().split('T')[0],
        odemeVadesi: 'Vadeli_30',
        durum: 'Ordered',
        oncelik: reqItem.aciliyet === 'Urgent' ? 'Urgent' : 'Normal',
        stokId: reqItem.stokId,
        miktar: parseFloat(reqItem.talepEdilenMiktar) || 1,
        birimFiyat: stockItem ? parseFloat(stockItem.alisFiyati) || 10 : 10,
        kdvOrani: 20,
        paraBirimi: stockItem ? stockItem.paraBirimi || 'TRY' : 'TRY',
        notlar: `[Talep No: ${reqItem.talepNo}] ${reqItem.kaynakModul} Modülünden gelen talep doğrultusunda oluşturuldu.`,
        satinAlmaci: req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi
      }, req.user, req.ip);

      await requisitionRepository.updateStatus(id, 'Ordered', req.user, req.ip);
    }

    res.redirect('/purchase/orders');
  });

  // ═══════════════════════ RFQ ═══════════════════════
  listRfqs = asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    const rfqs = await purchaseService.getAllRfqs({ search, status });
    const rfqStats = await purchaseService.getRfqStats();

    const groupedMap = new Map();

    rfqs.forEach(rfq => {
      let productsInRfq = [];

      const itemsData = rfq.kalemlerVerisi || rfq.itemsData;
      if (itemsData && Array.isArray(itemsData) && itemsData.length > 0) {
        itemsData.forEach(item => {
          const sId = item.stokId || item.stockItemId;
          if (sId) {
            productsInRfq.push({
              stockItemId: parseInt(sId, 10),
              stockCode: item.stokKodu || item.stockCode || 'STK-000',
              itemName: item.ad || item.productName || 'Belirtilmemiş Ürün',
              unit: item.birim || item.unit || 'Adet',
              unitPrice: parseFloat(item.birimFiyat || item.unitPrice) || 0,
              quantity: parseFloat(item.miktar || item.quantity) || 1
            });
          }
        });
      }

      if (productsInRfq.length === 0 && rfq.stokId) {
        productsInRfq.push({
          stockItemId: parseInt(rfq.stokId, 10),
          stockCode: rfq.stokKarti ? rfq.stokKarti.stokKodu : 'GENEL-000',
          itemName: rfq.stokKarti ? rfq.stokKarti.ad : 'Genel Malzeme',
          unit: rfq.stokKarti ? rfq.stokKarti.birim : 'Adet',
          unitPrice: parseFloat(rfq.teklifEdilenBirimFiyat) || 0,
          quantity: parseFloat(rfq.talepEdilenMiktar) || 1
        });
      }

      productsInRfq.forEach(prod => {
        const key = prod.stockItemId;
        if (!groupedMap.has(key)) {
          groupedMap.set(key, {
            stockItemId: key,
            stockCode: prod.stockCode,
            itemName: prod.itemName,
            unit: prod.unit,
            items: [],
            recommendedOffer: null
          });
        }

        const group = groupedMap.get(key);
        if (!group.items.some(i => i.id === rfq.id)) {
          const offerCopy = {
            ...(rfq.toJSON ? rfq.toJSON() : rfq),
            itemUnitPrice: prod.unitPrice,
            itemQuantity: prod.quantity
          };
          group.items.push(offerCopy);
        }
      });
    });

    const groupedRfqs = Array.from(groupedMap.values());

    const acceptedStockItemIds = new Set();
    rfqs.forEach(rfq => {
      const rfqObj = rfq.toJSON ? rfq.toJSON() : rfq;
      if (rfqObj.durum === 'Accepted') {
        const items = (rfqObj.kalemlerVerisi && Array.isArray(rfqObj.kalemlerVerisi)) ? rfqObj.kalemlerVerisi : [];
        items.forEach(item => {
          if (item.stokId || item.stockItemId) acceptedStockItemIds.add(parseInt(item.stokId || item.stockItemId, 10));
        });
        if (items.length === 0 && rfqObj.stokId) {
          acceptedStockItemIds.add(parseInt(rfqObj.stokId, 10));
        }
      }
    });

    groupedRfqs.forEach(group => {
      group.isLocked = acceptedStockItemIds.has(group.stockItemId);

      const validOffers = group.items.filter(o => o.itemUnitPrice && parseFloat(o.itemUnitPrice) > 0);

      if (validOffers.length > 0) {
        const prices = validOffers.map(o => parseFloat(o.itemUnitPrice));
        const minPrice = Math.min(...prices);

        const daysList = validOffers.map(o => parseInt(o.teslimSuresiGun || o.deliveryDays, 10) || 7);
        const minDeliveryDays = Math.min(...daysList);

        validOffers.forEach(o => {
          const unitPrice = parseFloat(o.itemUnitPrice) || 1;
          const priceScore = minPrice > 0 ? (minPrice / unitPrice) * 100 : 50;

          const days = parseInt(o.teslimSuresiGun || o.deliveryDays, 10) || 7;
          const deliveryScore = minDeliveryDays > 0 ? Math.min(100, Math.max(30, (minDeliveryDays / days) * 100)) : 70;

          const supplierRating = o.tedarikci ? (parseFloat(o.tedarikci.performansSkoru) || parseFloat(o.tedarikci.kaliteSkoru) || 85) : 85;

          let termBonus = 0;
          const term = o.odemeVadesi || o.paymentTerm;
          if (term === 'Vadeli_90') termBonus = 15;
          else if (term === 'Vadeli_60') termBonus = 10;
          else if (term === 'Vadeli_30') termBonus = 5;

          const deliveryTermScore = Math.min(100, deliveryScore + termBonus);
          const totalScore = (priceScore * 0.50) + (deliveryTermScore * 0.25) + (supplierRating * 0.25);
          o.fpScore = Math.round(totalScore);
        });

        validOffers.sort((a, b) => b.fpScore - a.fpScore);
        const winner = validOffers[0];
        if (winner) winner.isRecommended = true;
        group.recommendedOffer = winner;
      }
    });

    res.render('purchase/rfq', {
      user: req.user,
      rfqs,
      groupedRfqs,
      rfqStats,
      filterSearch: search || '',
      filterStatus: status || ''
    });
  });

  renderAddRfq = asyncHandler(async (req, res) => {
    const nextRfqNo = await purchaseService.getNextRfqNo();
    const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });

    let requisitions = [];
    try {
      requisitions = await SatinAlmaTalebi.findAll({
        where: { durum: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
        include: [{ model: StokKarti, as: 'stokKarti' }],
        order: [['createdAt', 'DESC']]
      });
    } catch (e) {
      console.error('Error fetching requisitions in renderAddRfq:', e);
    }

    const reqMap = new Map();
    requisitions.forEach(reqItem => {
      if (reqItem.stokKarti && !reqMap.has(reqItem.stokKarti.id)) {
        const minStockVal = parseFloat(reqItem.stokKarti.asgariStok) || 10;
        reqMap.set(reqItem.stokKarti.id, {
          stockItemId: reqItem.stokKarti.id,
          stockCode: reqItem.stokKarti.stokKodu,
          name: reqItem.stokKarti.ad,
          category: reqItem.stokKarti.kategori,
          unit: reqItem.stokKarti.birim || 'Adet',
          minStock: minStockVal > 0 ? minStockVal : 10,
          purchasePrice: parseFloat(reqItem.stokKarti.alisFiyati) || 0,
          requisitionNo: reqItem.talepNo,
          requisitionId: reqItem.id,
          requestedQuantity: parseFloat(reqItem.talepEdilenMiktar) || minStockVal || 10
        });
      }
    });

    let requisitionedProducts = Array.from(reqMap.values());

    if (requisitionedProducts.length === 0) {
      const allItems = await StokKarti.findAll({ where: { durum: 'Active' }, order: [['ad', 'ASC']] });
      requisitionedProducts = allItems.map(item => {
        const minStockVal = parseFloat(item.asgariStok) || 10;
        return {
          stockItemId: item.id,
          stockCode: item.stokKodu,
          name: item.ad,
          category: item.kategori,
          unit: item.birim || 'Adet',
          minStock: minStockVal > 0 ? minStockVal : 10,
          purchasePrice: parseFloat(item.alisFiyati) || 0,
          requisitionNo: 'TAL-GENEL',
          requisitionId: 0,
          requestedQuantity: minStockVal || 10
        };
      });
    }

    const targetReqId = req.query.requisitionId ? parseInt(req.query.requisitionId, 10) : null;
    let targetStockItemId = req.query.stockItemId ? parseInt(req.query.stockItemId, 10) : null;

    if (targetReqId && !targetStockItemId) {
      try {
        const reqObj = await SatinAlmaTalebi.findByPk(targetReqId);
        if (reqObj && reqObj.stokId) {
          targetStockItemId = reqObj.stokId;
        }
      } catch (e) {
        console.error('Error finding target requisition:', e);
      }
    }

    if (targetStockItemId) {
      const existingIdx = requisitionedProducts.findIndex(p => parseInt(p.stockItemId, 10) === targetStockItemId);
      if (existingIdx > 0) {
        const [targetProd] = requisitionedProducts.splice(existingIdx, 1);
        requisitionedProducts.unshift(targetProd);
      } else if (existingIdx < 0) {
        const targetItem = await StokKarti.findByPk(targetStockItemId);
        if (targetItem) {
          const minStockVal = parseFloat(targetItem.asgariStok) || 10;
          requisitionedProducts.unshift({
            stockItemId: targetItem.id,
            stockCode: targetItem.stokKodu,
            name: targetItem.ad,
            category: targetItem.kategori,
            unit: targetItem.birim || 'Adet',
            minStock: minStockVal > 0 ? minStockVal : 10,
            purchasePrice: parseFloat(targetItem.alisFiyati) || 0,
            requisitionNo: targetReqId ? `TALEP-#${targetReqId}` : 'TAL-GENEL',
            requisitionId: targetReqId || 0,
            requestedQuantity: minStockVal || 10
          });
        }
      }
    }

    const acceptedRfqs = await SatinAlmaTeklifTalebi.findAll({
      where: { durum: 'Accepted' }
    });
    const acceptedStockItemIds = new Set();
    acceptedRfqs.forEach(rfq => {
      const items = (rfq.kalemlerVerisi && Array.isArray(rfq.kalemlerVerisi)) ? rfq.kalemlerVerisi : [];
      items.forEach(item => {
        if (item.stokId || item.stockItemId) acceptedStockItemIds.add(parseInt(item.stokId || item.stockItemId, 10));
      });
      if (items.length === 0 && rfq.stokId) {
        acceptedStockItemIds.add(parseInt(rfq.stokId, 10));
      }
    });

    const warehouses = await Depo.findAll({
      where: { durum: 'Active' },
      order: [['ad', 'ASC']]
    });

    res.render('purchase/rfq_add', {
      user: req.user,
      error: null,
      nextRfqNo,
      suppliers,
      requisitionedProducts,
      acceptedStockItemIds: Array.from(acceptedStockItemIds),
      targetReqId,
      targetStockItemId,
      warehouses,
      formData: {}
    });
  });

  addRfq = asyncHandler(async (req, res) => {
    try {
      const supplierId = req.body.supplierId || req.body.tedarikciId ? parseInt(req.body.supplierId || req.body.tedarikciId, 10) : null;
      let supplierName = req.body.supplierName || req.body.tedarikciAdi ? (req.body.supplierName || req.body.tedarikciAdi).trim() : '';

      if (supplierId) {
        const supObj = await Tedarikci.findByPk(supplierId);
        if (supObj) supplierName = supObj.firmaAdi;
      }

      let itemsData = [];
      if (Array.isArray(req.body.itemStockItemId)) {
        for (let i = 0; i < req.body.itemStockItemId.length; i++) {
          const sId = parseInt(req.body.itemStockItemId[i], 10);
          if (!sId) continue;
          const qty = parseFloat(req.body.itemQuantity[i]) || 1;
          const price = parseFloat(req.body.itemUnitPrice[i]) || 0;
          const disc = parseFloat(req.body.itemDiscountRate[i]) || 0;
          const vat = parseFloat(req.body.itemVatRate[i]) || 20;

          const rawTotal = qty * price;
          const discAmt = rawTotal * (disc / 100);
          const taxAmt = (rawTotal - discAmt) * (vat / 100);
          const net = rawTotal - discAmt + taxAmt;

          itemsData.push({
            stokId: sId,
            stokKodu: req.body.itemStockCode[i] || '',
            ad: req.body.itemProductName[i] || '',
            requisitionNo: req.body.itemRequisitionNo[i] || '',
            miktar: qty,
            birim: req.body.itemUnit[i] || 'Adet',
            birimFiyat: price,
            iskontoOrani: disc,
            kdvOrani: vat,
            netAmount: net,
            notlar: req.body.itemNotes ? (req.body.itemNotes[i] || '') : ''
          });
        }
      } else if (req.body.itemStockItemId) {
        const sId = parseInt(req.body.itemStockItemId, 10);
        if (sId) {
          const qty = parseFloat(req.body.itemQuantity) || 1;
          const price = parseFloat(req.body.itemUnitPrice) || 0;
          const disc = parseFloat(req.body.itemDiscountRate) || 0;
          const vat = parseFloat(req.body.itemVatRate) || 20;

          const rawTotal = qty * price;
          const discAmt = rawTotal * (disc / 100);
          const taxAmt = (rawTotal - discAmt) * (vat / 100);
          const net = rawTotal - discAmt + taxAmt;

          itemsData.push({
            stokId: sId,
            stokKodu: req.body.itemStockCode || '',
            ad: req.body.itemProductName || '',
            requisitionNo: req.body.itemRequisitionNo || '',
            miktar: qty,
            birim: req.body.itemUnit || 'Adet',
            birimFiyat: price,
            iskontoOrani: disc,
            kdvOrani: vat,
            netAmount: net,
            notlar: req.body.itemNotes || ''
          });
        }
      }

      const subtotal = parseFloat(req.body.subtotal || req.body.araToplam) || 0;
      const totalDiscount = parseFloat(req.body.totalDiscount || req.body.toplamIskonto) || 0;
      const totalTax = parseFloat(req.body.totalTax || req.body.toplamKdv) || 0;
      const offeredTotalPrice = parseFloat(req.body.offeredTotalPrice || req.body.teklifEdilenToplamFiyat) || (subtotal - totalDiscount + totalTax);

      const firstItem = itemsData[0] || {};

      await purchaseService.createRfq({
        teklifTalepNo: req.body.teklifTalepNo || req.body.rfqNo,
        tedarikciId: supplierId,
        tedarikciAdi: supplierName,
        stokId: firstItem.stokId || 1,
        talepEdilenMiktar: firstItem.miktar || 1,
        teklifEdilenBirimFiyat: firstItem.birimFiyat || 0,
        teklifEdilenToplamFiyat: offeredTotalPrice,
        araToplam: subtotal,
        toplamIskonto: totalDiscount,
        toplamKdv: totalTax,
        kalemlerVerisi: itemsData,
        paraBirimi: req.body.paraBirimi || req.body.currency || 'TRY',
        odemeVadesi: req.body.odemeVadesi || req.body.paymentTerm || 'Pesin',
        teslimSuresiGun: req.body.teslimSuresiGun || req.body.deliveryDays ? parseInt(req.body.teslimSuresiGun || req.body.deliveryDays, 10) : null,
        teslimYeri: req.body.teslimYeri || req.body.deliveryPlace || null,
        sevkiyatDurumu: req.body.sevkiyatDurumu || req.body.shippingStatus || null,
        kdvDurumu: req.body.kdvDurumu || req.body.vatStatus || null,
        belgeReferansi: req.body.belgeReferansi || req.body.documentRef || null,
        gecerlilikBitis: req.body.gecerlilikBitis || req.body.validUntil || null,
        teklifTalepTarihi: req.body.teklifTalepTarihi || req.body.rfqDate || new Date().toISOString().split('T')[0],
        durum: req.body.durum || req.body.status || 'Received',
        talepEden: req.body.talepEden || (req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi),
        notlar: req.body.notlar || req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/rfq');
    } catch (err) {
      console.error('addRfq Error:', err);
      const nextRfqNo = await purchaseService.getNextRfqNo();
      const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });
      const requisitions = await SatinAlmaTalebi.findAll({
        where: { durum: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
        include: [{ model: StokKarti, as: 'stokKarti' }]
      });

      const reqMap = new Map();
      requisitions.forEach(reqItem => {
        if (reqItem.stokKarti && !reqMap.has(reqItem.stokKarti.id)) {
          const minStockVal = parseFloat(reqItem.stokKarti.asgariStok) || 10;
          reqMap.set(reqItem.stokKarti.id, {
            stockItemId: reqItem.stokKarti.id,
            stockCode: reqItem.stokKarti.stokKodu,
            name: reqItem.stokKarti.ad,
            category: reqItem.stokKarti.kategori,
            unit: reqItem.stokKarti.birim || 'Adet',
            minStock: minStockVal > 0 ? minStockVal : 10,
            purchasePrice: parseFloat(reqItem.stokKarti.alisFiyati) || 0,
            requisitionNo: reqItem.talepNo,
            requisitionId: reqItem.id,
            requestedQuantity: parseFloat(reqItem.talepEdilenMiktar) || minStockVal || 10
          });
        }
      });

      const warehouses = await Depo.findAll({ where: { durum: 'Active' }, order: [['ad', 'ASC']] });

      res.render('purchase/rfq_add', {
        user: req.user,
        error: err.message || 'Teklif kaydedilirken hata oluştu.',
        nextRfqNo,
        suppliers,
        requisitionedProducts: Array.from(reqMap.values()),
        targetReqId: null,
        warehouses,
        formData: req.body
      });
    }
  });

  acceptRfq = asyncHandler(async (req, res) => {
    const order = await purchaseService.acceptRfq(req.params.id, req.user, req.ip);
    const orderNo = order ? (order.siparisNo || order.orderNo) : '';
    res.redirect(`/purchase/orders?success=created&orderNo=${encodeURIComponent(orderNo)}`);
  });

  rejectRfq = asyncHandler(async (req, res) => {
    await purchaseService.updateRfq(req.params.id, { durum: 'Rejected' }, req.user, req.ip);
    res.redirect('/purchase/rfq');
  });

  // ═══════════════════════ SUPPLIERS ═══════════════════════
  listSuppliers = asyncHandler(async (req, res) => {
    const { search, status } = req.query;
    const suppliers = await purchaseService.getAllSuppliers({ search, status });
    const supplierStats = await purchaseService.getSupplierStats();

    res.render('purchase/suppliers', {
      user: req.user,
      suppliers,
      supplierStats,
      filterSearch: search || '',
      filterStatus: status || ''
    });
  });

  renderAddSupplier = asyncHandler(async (req, res) => {
    const nextCode = await purchaseService.getNextSupplierCode();

    res.render('purchase/supplier_add', {
      user: req.user,
      error: null,
      nextCode,
      formData: {}
    });
  });

  addSupplier = asyncHandler(async (req, res) => {
    const rawData = req.body;
    try {
      const tedarikciKodu = (rawData.tedarikciKodu || rawData.supplierCode || '').trim();
      const firmaAdi = (rawData.firmaAdi || rawData.companyName || rawData.firmaUnvani || '').trim();
      const ticariAd = (rawData.ticariAd || rawData.commercialName || '').trim() || null;
      const kategori = rawData.kategori || rawData.category || 'Hammadde';
      const vergiDairesi = (rawData.vergiDairesi || rawData.taxOffice || '').trim() || null;
      const vergiNo = (rawData.vergiNo || rawData.taxNo || '').trim() || null;
      const adres = (rawData.adres || rawData.address || rawData.faturaAdresi || '').trim() || null;
      const sehir = (rawData.sehir || rawData.city || '').trim() || null;
      const ulke = (rawData.ulke || rawData.country || 'Türkiye').trim();
      const bankaBilgileri = (rawData.bankaBilgileri || rawData.bankAccountInfo || '').trim() || null;
      const paraBirimi = rawData.paraBirimi || rawData.currency || 'TRY';
      const odemeVadesi = rawData.odemeVadesi || rawData.paymentTerm || 'Vadeli_30';
      const ilgiliKisi = (rawData.ilgiliKisi || rawData.contactPerson || rawData.salesRepresentative || '').trim() || null;
      const eposta = (rawData.eposta || rawData.email || '').trim() || null;
      const telefon = (rawData.telefon || rawData.phone || '').trim() || null;
      const gsm = (rawData.gsm || rawData.mobilePhone || '').trim() || null;
      const webSitesi = (rawData.webSitesi || rawData.website || '').trim() || null;
      const teslimatSekli = rawData.teslimatSekli || rawData.deliveryTerms || 'DAP - Adrese / Fabrikaya Teslim';
      const terminSuresi = parseInt(rawData.terminSuresi || rawData.leadTimeDays || rawData.deliveryDays, 10) || 7;
      let performansSkoru = parseFloat(rawData.performansSkoru !== undefined ? rawData.performansSkoru : (rawData.performanceScore !== undefined ? rawData.performanceScore : 85));
      if (isNaN(performansSkoru) || performansSkoru < 0) performansSkoru = 0;
      if (performansSkoru > 100) performansSkoru = 100;
      const durum = rawData.durum || rawData.status || 'Active';
      const notlar = (rawData.notlar || rawData.notes || '').trim() || null;

      // Backend Validasyonları
      if (!tedarikciKodu) {
        throw new Error('Tedarikçi kodu zorunludur.');
      }
      if (!firmaAdi || firmaAdi.length < 2) {
        throw new Error('Firma resmi unvanı en az 2 karakter olmalıdır ve zorunludur.');
      }
      if (eposta && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
        throw new Error('Lütfen geçerli bir e-posta adresi giriniz.');
      }
      if (vergiNo && !/^[0-9]{10,11}$/.test(vergiNo.replace(/[\s-]/g, ''))) {
        throw new Error('Vergi numarası 10 haneli (Tüzel) veya 11 haneli (Şahıs) rakamlardan oluşmalıdır.');
      }
      if (terminSuresi < 1) {
        throw new Error('Varsayılan termin süresi en az 1 gün olmalıdır.');
      }

      await purchaseService.createSupplier({
        tedarikciKodu,
        firmaAdi,
        ticariAd,
        kategori,
        vergiDairesi,
        vergiNo,
        adres,
        sehir,
        ulke,
        bankaBilgileri,
        paraBirimi,
        odemeVadesi,
        ilgiliKisi,
        eposta,
        telefon,
        gsm,
        webSitesi,
        teslimatSekli,
        terminSuresi,
        performansSkoru,
        kaliteSkoru: performansSkoru,
        durum,
        notlar
      }, req.user, req.ip);

      res.redirect('/purchase/suppliers');
    } catch (err) {
      const nextCode = await purchaseService.getNextSupplierCode();

      res.render('purchase/supplier_add', {
        user: req.user,
        error: err.message || 'Tedarikçi eklenirken hata oluştu.',
        nextCode: rawData.supplierCode || rawData.tedarikciKodu || nextCode,
        formData: req.body
      });
    }
  });

  viewSupplierDetail = asyncHandler(async (req, res) => {
    const supplier = await purchaseService.getSupplierWithOrders(req.params.id);

    res.render('purchase/supplier_detail', {
      user: req.user,
      supplier
    });
  });

  // ═══════════════════════ GOODS RECEIPT & INVOICING ═══════════════════════
  listGoodsReceipts = asyncHandler(async (req, res) => {
    const { search, status, qualityStatus } = req.query;
    const allReceipts = await purchaseService.getAllGoodsReceipts({ search, status, qualityStatus });
    
    const receipts = allReceipts.filter(grn => grn.satinAlmaSiparisi && (grn.satinAlmaSiparisi.durum === 'Received' || grn.satinAlmaSiparisi.status === 'Received'));
    const grnStats = await purchaseService.getGoodsReceiptStats();

    const receivedOrders = await SatinAlmaSiparisi.findAll({
      where: { durum: 'Received' },
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: Tedarikci, as: 'tedarikci' }
      ],
      order: [['updatedAt', 'DESC']]
    });

    const awaitingOrders = await Promise.all(receivedOrders.map(async (order) => {
      const invoice = await purchaseInvoiceRepository.findByOrderId(order.id);
      let items = [];
      const itemsJson = order.kalemlerJson || order.itemsJson;
      if (itemsJson) {
        try { items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson; } catch (e) { items = []; }
      }
      if (!items || items.length === 0) {
        items = [{
          stokId: order.stokId,
          stokKodu: order.stokKarti ? order.stokKarti.stokKodu : 'STK-001',
          ad: order.stokKarti ? order.stokKarti.ad : 'Ürün Kalemi',
          miktar: order.miktar,
          birim: order.stokKarti ? order.stokKarti.birim : 'Adet',
          birimFiyat: order.birimFiyat
        }];
      }

      return {
        ...(order.toJSON ? order.toJSON() : order),
        items,
        hasInvoice: !!invoice,
        existingInvoice: invoice ? (invoice.toJSON ? invoice.toJSON() : invoice) : null
      };
    }));

    const nextInvoiceNo = await purchaseInvoiceRepository.getNextInvoiceNo();

    res.render('purchase/goods_receipt', {
      user: req.user,
      receipts,
      grnStats,
      awaitingOrders,
      nextInvoiceNo,
      filterSearch: search || '',
      filterStatus: status || '',
      filterQualityStatus: qualityStatus || '',
      success: req.query.success || null,
      error: req.query.error || null
    });
  });

  createInvoiceFromOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await purchaseRepository.findById(id);
    if (!order) {
      return res.redirect('/purchase/goods-receipt?error=' + encodeURIComponent('Satın alma siparişi bulunamadı.'));
    }

    if (order.durum !== 'Received') {
      return res.redirect('/purchase/goods-receipt?error=' + encodeURIComponent('Sadece mal kabul süreci tamamlanan (Teslim Alındı) siparişler için fatura kesilebilir.'));
    }

    const existingInvoice = await purchaseInvoiceRepository.findByOrderId(order.id);
    if (existingInvoice) {
      return res.redirect('/purchase/goods-receipt?error=' + encodeURIComponent(`⚠️ Bu sipariş (${order.siparisNo}) için daha önce ${existingInvoice.faturaNo} numaralı alış faturası kesilmiştir! Her sipariş için sadece bir fatura oluşturulabilir.`));
    }

    let grn = null;
    try {
      grn = await MalKabul.findOne({ where: { satinAlmaSiparisId: order.id }, order: [['id', 'DESC']] });
    } catch (e) {
      console.warn('MalKabul lookup failed:', e.message);
    }

    const dispatchNo = req.body.dispatchNo && req.body.dispatchNo.trim() ? req.body.dispatchNo.trim() : (grn ? grn.irsaliyeNo : `IRS-${order.siparisNo}`);
    const dispatchDate = req.body.dispatchDate && req.body.dispatchDate.trim() ? req.body.dispatchDate.trim() : (grn ? grn.kabulTarihi : (order.siparisTarihi || new Date().toISOString().split('T')[0]));

    const bankName = req.body.bankName && req.body.bankName.trim() ? req.body.bankName.trim() : 'T.C. Ziraat Bankası A.Ş. - Maslak Kurumsal Şubesi';
    const ibanNo = req.body.ibanNo && req.body.ibanNo.trim() ? req.body.ibanNo.trim() : 'TR62 0001 0000 0000 0000 1234 56';

    let invoiceNo = req.body.invoiceNo && req.body.invoiceNo.trim() ? req.body.invoiceNo.trim() : null;
    if (!invoiceNo || (await purchaseInvoiceRepository.findByInvoiceNo(invoiceNo))) {
      invoiceNo = await purchaseInvoiceRepository.getNextInvoiceNo();
    }
    const invoiceDate = req.body.invoiceDate && req.body.invoiceDate.trim() ? req.body.invoiceDate.trim() : new Date().toISOString().split('T')[0];

    const grandTotal = parseFloat(order.toplamTutar) || 0;
    const subtotal = parseFloat(req.body.subtotal) || (parseFloat(order.araToplam) || grandTotal / 1.2);
    const taxAmount = parseFloat(req.body.taxAmount) || (parseFloat(order.kdvTutari) || grandTotal - subtotal);

    await purchaseInvoiceRepository.create({
      faturaNo: invoiceNo,
      satinAlmaSiparisId: order.id,
      tedarikciId: order.tedarikciId,
      tedarikciAdi: order.tedarikciAdi || (order.tedarikci ? order.tedarikci.firmaAdi : 'Tedarikçi Firma'),
      tedarikciVergiDairesi: order.tedarikci ? order.tedarikci.vergiDairesi : (order.tedarikciVergiNo || 'Kadıköy V.D.'),
      tedarikciVergiNo: order.tedarikciVergiNo || (order.tedarikci ? order.tedarikci.vergiNo : '1234567890'),
      faturaAdresi: order.tedarikci ? order.tedarikci.adres : 'Organize Sanayi Bölgesi, No: 45 Kadıköy / İSTANBUL',
      tedarikciTelefon: order.tedarikciTelefon || (order.tedarikci ? order.tedarikci.telefon : '+90 (216) 555 0000'),
      tedarikciEposta: order.tedarikciEposta || (order.tedarikci ? order.tedarikci.eposta : 'muhasebe@tedarikci.com'),
      faturaTarihi: invoiceDate,
      siparisNo: order.siparisNo,
      siparisTarihi: order.siparisTarihi,
      irsaliyeNo: dispatchNo,
      irsaliyeTarihi: dispatchDate,
      bankaAdi: bankName,
      ibanNo,
      araToplam: parseFloat(subtotal.toFixed(2)),
      iskontoTutari: parseFloat(order.iskontoTutari) || 0,
      kdvTutari: parseFloat(taxAmount.toFixed(2)),
      toplamTutar: parseFloat(grandTotal.toFixed(2)),
      paraBirimi: order.paraBirimi || 'TRY',
      odemeVadesi: order.odemeVadesi || 'Vadeli_30',
      kalemlerJson: order.kalemlerJson,
      notlar: req.body.notes || `[Satın Alma Siparişi No: ${order.siparisNo} | Mal Kabul İrsaliye No: ${dispatchNo}] Mal kabulü tamamlanan sipariş için kesilen resmi alış faturasıdır.`
    }, req.user, req.ip);

    res.redirect('/purchase/goods-receipt?success=invoice_created');
  });

  viewInvoiceDetail = asyncHandler(async (req, res) => {
    const convertNumberToTurkishWords = require('../utils/numberToWords');
    const invoice = await purchaseInvoiceRepository.findById(req.params.id);
    if (!invoice) throw new NotFoundError('Satın alma faturası bulunamadı.');

    let items = [];
    const itemsJson = invoice.kalemlerJson || invoice.itemsJson;
    if (itemsJson) {
      try { items = typeof itemsJson === 'string' ? JSON.parse(itemsJson) : itemsJson; } catch (e) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        stokKodu: invoice.satinAlmaSiparisi && invoice.satinAlmaSiparisi.stokKarti ? invoice.satinAlmaSiparisi.stokKarti.stokKodu : 'STK-001',
        ad: invoice.satinAlmaSiparisi && invoice.satinAlmaSiparisi.stokKarti ? invoice.satinAlmaSiparisi.stokKarti.ad : 'Satın Alınan Malzeme Kalemi',
        miktar: invoice.satinAlmaSiparisi ? invoice.satinAlmaSiparisi.miktar : 1,
        birim: invoice.satinAlmaSiparisi && invoice.satinAlmaSiparisi.stokKarti ? invoice.satinAlmaSiparisi.stokKarti.birim : 'Adet',
        birimFiyat: invoice.araToplam || invoice.toplamTutar / 1.2
      }];
    }

    const wordsTotal = convertNumberToTurkishWords(invoice.toplamTutar);

    res.render('purchase/invoice_view', {
      user: req.user,
      invoice,
      items,
      wordsTotal
    });
  });

  renderAddGoodsReceipt = asyncHandler(async (req, res) => {
    const nextGrnNo = await purchaseService.getNextGrnNo();
    const orders = await purchaseService.getAllOrders({ status: 'Ordered' });
    const partialOrders = await purchaseService.getAllOrders({ status: 'Partial_Received' });
    const allOpenOrders = [...orders, ...partialOrders];

    res.render('purchase/goods_receipt_add', {
      user: req.user,
      error: null,
      nextGrnNo,
      orders: allOpenOrders,
      formData: {}
    });
  });

  addGoodsReceipt = asyncHandler(async (req, res) => {
    try {
      const receivedQty = parseFloat(req.body.receivedQuantity || req.body.teslimAlinanMiktar) || 0;
      const acceptedQty = parseFloat(req.body.acceptedQuantity || req.body.kabulEdilenMiktar) || receivedQty;
      const rejectedQty = receivedQty - acceptedQty;

      await purchaseService.createGoodsReceipt({
        kabulNo: req.body.kabulNo || req.body.grnNo,
        satinAlmaSiparisId: parseInt(req.body.satinAlmaSiparisId || req.body.purchaseOrderId, 10),
        tedarikciId: req.body.tedarikciId || req.body.supplierId ? parseInt(req.body.tedarikciId || req.body.supplierId, 10) : null,
        stokId: parseInt(req.body.stokId || req.body.stockItemId, 10),
        siparisMiktari: parseFloat(req.body.siparisMiktari || req.body.orderedQuantity) || 0,
        teslimAlinanMiktar: receivedQty,
        kabulEdilenMiktar: acceptedQty,
        reddedilenMiktar: rejectedQty > 0 ? rejectedQty : 0,
        kabulTarihi: req.body.kabulTarihi || req.body.receiptDate || new Date().toISOString().split('T')[0],
        irsaliyeNo: req.body.irsaliyeNo || req.body.deliveryNoteNo || null,
        kaliteDurumu: req.body.kaliteDurumu || req.body.qualityStatus || 'Approved',
        kabulEdenAdi: req.body.kabulEdenAdi || req.body.inspectorName || (req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi),
        kaliteNotlari: req.body.kaliteNotlari || req.body.qualityNotes || null,
        depoLokasyonu: req.body.depoLokasyonu || req.body.warehouseLocation || null,
        durum: acceptedQty >= parseFloat(req.body.siparisMiktari || req.body.orderedQuantity) ? 'Completed' : 'Partial',
        notlar: req.body.notlar || req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/goods-receipt');
    } catch (err) {
      const nextGrnNo = await purchaseService.getNextGrnNo();
      const orders = await purchaseService.getAllOrders({ status: 'Ordered' });

      res.render('purchase/goods_receipt_add', {
        user: req.user,
        error: err.message || 'Mal kabul fişi oluşturulurken hata oluştu.',
        nextGrnNo,
        orders,
        formData: req.body
      });
    }
  });

  // ═══════════════════════ APPROVALS ═══════════════════════
  listApprovals = asyncHandler(async (req, res) => {
    const { pendingOrders, pendingRequisitions } = await purchaseService.getPendingApprovals();

    res.render('purchase/approvals', {
      user: req.user,
      pendingOrders,
      pendingRequisitions
    });
  });

  approveAction = asyncHandler(async (req, res) => {
    const { type, id } = req.params;
    const { action } = req.body;

    if (type === 'order') {
      await purchaseService.approveOrder(id, action, req.user, req.ip);
    } else if (type === 'requisition') {
      await purchaseService.approveRequisition(id, action, req.user, req.ip);
    }

    res.redirect('/purchase/approvals');
  });
}

module.exports = new PurchaseController();
