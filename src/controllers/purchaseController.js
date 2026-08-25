const purchaseInvoiceRepository = require('../repositories/purchaseInvoiceRepository');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('../services/purchaseService');
const stockService = require('../services/stockService');
const requisitionRepository = require('../repositories/requisitionRepository');
const supplierRepository = require('../repositories/supplierRepository');
const rfqRepository = require('../repositories/rfqRepository');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const asyncHandler = require('../utils/asyncHandler');
const { ValidationError } = require('../utils/appError');
const currencyService = require('../services/currencyService');
const rfqPdfService = require('../services/rfqPdfService');
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
    const rawRfqs = await purchaseService.getAllRfqs({ search, status });
    const rfqStats = await purchaseService.getRfqStats();
    const liveRates = await currencyService.getLiveRates();

    const rfqs = rawRfqs.map(r => {
      const rfqObj = r.toJSON ? r.toJSON() : r;
      const items = (rfqObj.kalemlerVerisi && Array.isArray(rfqObj.kalemlerVerisi)) ? rfqObj.kalemlerVerisi : [];
      const curr = (rfqObj.paraBirimi || 'TRY').toUpperCase();
      
      const isAccepted = rfqObj.durum === 'Accepted';
      const isLocked = isAccepted && !!rfqObj.kilitliDovizKuru;
      const currentRate = isLocked ? parseFloat(rfqObj.kilitliDovizKuru) : (liveRates[curr] || 1.0);
      
      const totalPrice = parseFloat(rfqObj.teklifEdilenToplamFiyat || rfqObj.offeredTotalPrice || rfqObj.araToplam || 0);
      const subtotal = parseFloat(rfqObj.araToplam || rfqObj.subtotal || 0);
      const discount = parseFloat(rfqObj.toplamIskonto || rfqObj.totalDiscount || 0);
      const vat = parseFloat(rfqObj.toplamKdv || rfqObj.totalTax || 0);
      const totalPriceTRY = isLocked && rfqObj.kilitliToplamTRY 
        ? parseFloat(rfqObj.kilitliToplamTRY) 
        : currencyService.convertToTRY(totalPrice, curr, liveRates);
      
      return {
        ...rfqObj,
        rfqNo: rfqObj.teklifTalepNo || rfqObj.rfqNo,
        supplierName: rfqObj.tedarikciAdi || (rfqObj.tedarikci ? (rfqObj.tedarikci.ticariAd || rfqObj.tedarikci.firmaAdi) : 'Tedarikçi'),
        supplierCode: rfqObj.tedarikci ? rfqObj.tedarikci.tedarikciKodu : '',
        supplierRating: rfqObj.tedarikci ? (parseFloat(rfqObj.tedarikci.performansSkoru) || parseFloat(rfqObj.tedarikci.kaliteSkoru) || 85) : 85,
        supplierTaxNo: rfqObj.tedarikci ? rfqObj.tedarikci.vergiNo : '',
        supplierTaxOffice: rfqObj.tedarikci ? rfqObj.tedarikci.vergiDairesi : '',
        supplierCity: rfqObj.tedarikci ? rfqObj.tedarikci.sehir : '',
        itemsData: items,
        totalPrice,
        totalPriceTRY,
        exchangeRate: currentRate,
        isLockedRate: isLocked,
        subtotal,
        discount,
        vat,
        currency: curr,
        paymentTerm: rfqObj.odemeVadesi || 'Vadeli_30',
        deliveryDays: rfqObj.teslimSuresiGun || 5,
        deliveryPlace: rfqObj.teslimYeri || 'Ana Hammadde & Üretim Ambarı',
        vatStatus: rfqObj.kdvDurumu || 'Hariç',
        rfqDate: rfqObj.teklifTalepTarihi || (rfqObj.createdAt ? new Date(rfqObj.createdAt).toISOString().split('T')[0] : ''),
        validUntil: rfqObj.gecerlilikBitis || '',
        status: rfqObj.durum || 'Received',
        notes: rfqObj.notlar || ''
      };
    });

    const groupedMap = new Map();

    rfqs.forEach(rfq => {
      let productsInRfq = [];

      if (rfq.itemsData && rfq.itemsData.length > 0) {
        rfq.itemsData.forEach(item => {
          const sId = item.stokId || item.stockItemId;
          if (sId) {
            const rawUnitPrice = parseFloat(item.birimFiyat || item.unitPrice) || 0;
            const rawNet = parseFloat(item.netAmount || item.netTutar) || 0;
            const unitPriceTRY = currencyService.convertToTRY(rawUnitPrice, rfq.currency, liveRates);
            const netAmountTRY = currencyService.convertToTRY(rawNet, rfq.currency, liveRates);

            productsInRfq.push({
              stockItemId: parseInt(sId, 10),
              stockCode: item.stokKodu || item.stockCode || 'STK-000',
              itemName: item.ad || item.productName || 'Malzeme',
              unit: item.birim || item.unit || 'Adet',
              unitPrice: rawUnitPrice,
              unitPriceTRY,
              quantity: parseFloat(item.teklifEdilenMiktar || item.miktar || item.quantity) || 1,
              discountRate: parseFloat(item.iskontoOrani || item.discountRate) || 0,
              vatRate: parseFloat(item.kdvOrani || item.vatRate) || 20,
              netAmount: rawNet,
              netAmountTRY
            });
          }
        });
      }

      if (productsInRfq.length === 0 && rfq.stokId) {
        const rawUnitPrice = parseFloat(rfq.teklifEdilenBirimFiyat) || 0;
        const unitPriceTRY = currencyService.convertToTRY(rawUnitPrice, rfq.currency, liveRates);
        productsInRfq.push({
          stockItemId: parseInt(rfq.stokId, 10),
          stockCode: rfq.stokKarti ? rfq.stokKarti.stokKodu : 'STK-000',
          itemName: rfq.stokKarti ? rfq.stokKarti.ad : 'Genel Malzeme',
          unit: rfq.stokKarti ? rfq.stokKarti.birim : 'Adet',
          unitPrice: rawUnitPrice,
          unitPriceTRY,
          quantity: parseFloat(rfq.talepEdilenMiktar) || 1,
          discountRate: 0,
          vatRate: 20,
          netAmount: parseFloat(rfq.totalPrice) || 0,
          netAmountTRY: parseFloat(rfq.totalPriceTRY) || 0
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
            ...rfq,
            itemUnitPrice: prod.unitPrice,
            itemUnitPriceTRY: prod.unitPriceTRY,
            itemQuantity: prod.quantity,
            itemDiscountRate: prod.discountRate,
            itemVatRate: prod.vatRate,
            itemNetAmount: prod.netAmount,
            itemNetAmountTRY: prod.netAmountTRY
          };
          group.items.push(offerCopy);
        }
      });
    });

    const groupedRfqs = Array.from(groupedMap.values());

    const acceptedStockItemIds = new Set();
    rfqs.forEach(rfq => {
      if (rfq.status === 'Accepted') {
        rfq.itemsData.forEach(item => {
          if (item.stokId || item.stockItemId) acceptedStockItemIds.add(parseInt(item.stokId || item.stockItemId, 10));
        });
        if (rfq.itemsData.length === 0 && rfq.stokId) {
          acceptedStockItemIds.add(parseInt(rfq.stokId, 10));
        }
      }
    });

    groupedRfqs.forEach(group => {
      group.isLocked = acceptedStockItemIds.has(group.stockItemId);

      // Filter valid offers by TRY price
      const validOffers = group.items.filter(o => o.itemUnitPriceTRY && parseFloat(o.itemUnitPriceTRY) > 0);

      if (validOffers.length > 0) {
        // Find minimum unit price IN TRY for fair currency comparison
        const pricesTRY = validOffers.map(o => parseFloat(o.itemUnitPriceTRY));
        const minPriceTRY = Math.min(...pricesTRY);

        const daysList = validOffers.map(o => parseInt(o.deliveryDays, 10) || 7);
        const minDeliveryDays = Math.min(...daysList);

        validOffers.forEach(o => {
          const unitPriceTRY = parseFloat(o.itemUnitPriceTRY) || 1;
          const priceScore = minPriceTRY > 0 ? (minPriceTRY / unitPriceTRY) * 100 : 50;

          const days = parseInt(o.deliveryDays, 10) || 7;
          const deliveryScore = minDeliveryDays > 0 ? Math.min(100, Math.max(30, (minDeliveryDays / days) * 100)) : 70;

          const supplierRating = o.supplierRating || 85;

          let termBonus = 0;
          const term = o.paymentTerm;
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
      liveRates,
      filterSearch: search || '',
      filterStatus: status || ''
    });
  });

  renderAddRfq = asyncHandler(async (req, res) => {
    const nextRfqNo = await purchaseService.getNextRfqNo();
    const suppliers = await Tedarikci.findAll({
      where: { durum: 'Active' },
      order: [['firmaAdi', 'ASC']]
    });

    const requisitions = await SatinAlmaTalebi.findAll({
      where: { durum: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
      include: [
        {
          model: StokKarti,
          as: 'stokKarti',
          include: [{ model: Tedarikci, as: 'tedarikciKarti' }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    const targetReqId = req.query.requisitionId ? parseInt(req.query.requisitionId, 10) : null;
    let targetStockItemId = req.query.stockItemId ? parseInt(req.query.stockItemId, 10) : null;

    let primaryRequisition = null;
    if (targetReqId) {
      primaryRequisition = requisitions.find(r => r.id === targetReqId);
      if (!primaryRequisition) {
        primaryRequisition = await SatinAlmaTalebi.findByPk(targetReqId, {
          include: [
            {
              model: StokKarti,
              as: 'stokKarti',
              include: [{ model: Tedarikci, as: 'tedarikciKarti' }]
            }
          ]
        });
      }
    }

    if (!primaryRequisition && targetStockItemId) {
      primaryRequisition = requisitions.find(r => r.stokId === targetStockItemId);
    }

    if (!primaryRequisition && requisitions.length > 0) {
      primaryRequisition = requisitions[0];
    }

    const availableRequisitions = requisitions.map(r => {
      const st = r.stokKarti;
      const sup = st ? st.tedarikciKarti : null;
      return {
        id: r.id,
        requisitionNo: r.talepNo,
        stockItemId: r.stokId,
        stockCode: st ? st.stokKodu : '',
        name: st ? st.ad : '',
        category: st ? st.kategori : 'Hammadde',
        unit: r.birim || (st ? st.birim : 'Adet'),
        requestedQuantity: parseFloat(r.talepEdilenMiktar) || 0,
        purchasePrice: parseFloat(st ? st.alisFiyati : 0) || 0,
        deliveryPlace: r.girisDeposu || (st ? st.depoLokasyonu : '') || 'Ana Hammadde & Üretim Ambarı',
        supplierId: sup ? sup.id : (st ? st.tedarikciId : null),
        supplierName: sup ? (sup.ticariAd || sup.firmaAdi) : (st ? st.tedarikci : ''),
        taxNo: sup ? sup.vergiNo : '',
        taxOffice: sup ? sup.vergiDairesi : '',
        contactPerson: sup ? sup.ilgiliKisi : '',
        currency: sup ? sup.paraBirimi : (st ? st.paraBirimi : 'TRY'),
        leadTime: sup ? sup.terminSuresi : 5,
        paymentTerm: sup ? sup.odemeVadesi : 'Vadeli_30',
        urgency: r.aciliyet || 'Normal',
        createdAt: r.createdAt
      };
    });

    let defaultSupplier = null;
    let defaultDeliveryPlace = 'Ana Hammadde & Üretim Ambarı';

    if (primaryRequisition && primaryRequisition.stokKarti) {
      const st = primaryRequisition.stokKarti;
      defaultDeliveryPlace = primaryRequisition.girisDeposu || st.depoLokasyonu || 'Ana Hammadde & Üretim Ambarı';
      if (st.tedarikciKarti) {
        defaultSupplier = st.tedarikciKarti;
      } else if (st.tedarikciId) {
        defaultSupplier = suppliers.find(s => s.id === st.tedarikciId);
      } else if (st.tedarikci) {
        defaultSupplier = suppliers.find(s => s.firmaAdi === st.tedarikci || s.ticariAd === st.tedarikci);
      }
    }

    if (!defaultSupplier && suppliers.length > 0) {
      defaultSupplier = suppliers[0];
    }

    const warehouses = await Depo.findAll({
      where: { durum: 'Active' },
      order: [['ad', 'ASC']]
    });

    res.render('purchase/rfq_add', {
      user: req.user,
      error: null,
      nextRfqNo,
      suppliers,
      availableRequisitions,
      primaryRequisition,
      defaultSupplier,
      defaultDeliveryPlace,
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
        if (supObj) {
          supplierName = supObj.firmaAdi;
        }
      }

      if (!supplierName) {
        throw new ValidationError('Lütfen teklifi veren tedarikçi firmayı seçiniz.');
      }

      let itemsData = [];
      const itemStockIds = Array.isArray(req.body.itemStockItemId) ? req.body.itemStockItemId : (req.body.itemStockItemId ? [req.body.itemStockItemId] : []);
      const itemReqIds = Array.isArray(req.body.itemRequisitionId) ? req.body.itemRequisitionId : (req.body.itemRequisitionId ? [req.body.itemRequisitionId] : []);
      const itemReqNos = Array.isArray(req.body.itemRequisitionNo) ? req.body.itemRequisitionNo : (req.body.itemRequisitionNo ? [req.body.itemRequisitionNo] : []);
      const itemCodes = Array.isArray(req.body.itemStockCode) ? req.body.itemStockCode : (req.body.itemStockCode ? [req.body.itemStockCode] : []);
      const itemNames = Array.isArray(req.body.itemProductName) ? req.body.itemProductName : (req.body.itemProductName ? [req.body.itemProductName] : []);
      const itemReqQtys = Array.isArray(req.body.itemRequestedQty) ? req.body.itemRequestedQty : (req.body.itemRequestedQty ? [req.body.itemRequestedQty] : []);
      const itemOfferedQtys = Array.isArray(req.body.itemOfferedQty) ? req.body.itemOfferedQty : (req.body.itemOfferedQty ? [req.body.itemOfferedQty] : []);
      const itemUnits = Array.isArray(req.body.itemUnit) ? req.body.itemUnit : (req.body.itemUnit ? [req.body.itemUnit] : []);
      const itemPrices = Array.isArray(req.body.itemUnitPrice) ? req.body.itemUnitPrice : (req.body.itemUnitPrice ? [req.body.itemUnitPrice] : []);
      const itemDiscounts = Array.isArray(req.body.itemDiscountRate) ? req.body.itemDiscountRate : (req.body.itemDiscountRate ? [req.body.itemDiscountRate] : []);
      const itemVats = Array.isArray(req.body.itemVatRate) ? req.body.itemVatRate : (req.body.itemVatRate ? [req.body.itemVatRate] : []);

      if (itemStockIds.length === 0) {
        throw new ValidationError('Teklifte en az bir adet satın alma talepli ürün bulunmalıdır.');
      }

      let subtotal = 0;
      let totalDiscount = 0;
      let totalTax = 0;
      let netTotal = 0;
      const isVatIncluded = req.body.vatStatus === 'Dahil' || req.body.kdvDurumu === 'Dahil';

      for (let i = 0; i < itemStockIds.length; i++) {
        const sId = parseInt(itemStockIds[i], 10);
        if (!sId) continue;

        const reqQty = parseFloat(itemReqQtys[i]) || 1;
        const offQty = parseFloat(itemOfferedQtys[i]) || 0;
        const price = parseFloat(itemPrices[i]) || 0;
        const disc = parseFloat(itemDiscounts[i]) || 0;
        const vat = parseFloat(itemVats[i]) !== undefined && itemVats[i] !== '' ? parseFloat(itemVats[i]) : 20;

        if (offQty <= 0) {
          throw new ValidationError(`[${itemCodes[i] || 'Ürün'}] için geçerli bir teklif miktarı girilmelidir (0'dan büyük olmalıdır).`);
        }

        if (offQty > reqQty) {
          throw new ValidationError(`[${itemCodes[i] || 'Ürün'}] için teklif edilen miktar (${offQty}), talep edilen miktardan (${reqQty}) fazla olamaz!`);
        }

        if (price <= 0) {
          throw new ValidationError(`[${itemCodes[i] || 'Ürün'}] için birim fiyatı zorunludur ve 0'dan büyük olmalıdır.`);
        }

        const rawTotal = offQty * price;
        const discAmt = rawTotal * (disc / 100);
        const discTotal = rawTotal - discAmt;
        let taxAmt = 0;
        let lineNet = 0;

        if (isVatIncluded) {
          taxAmt = discTotal - (discTotal / (1 + (vat / 100)));
          lineNet = discTotal;
        } else {
          taxAmt = discTotal * (vat / 100);
          lineNet = discTotal + taxAmt;
        }

        subtotal += rawTotal;
        totalDiscount += discAmt;
        totalTax += taxAmt;
        netTotal += lineNet;

        itemsData.push({
          talepId: parseInt(itemReqIds[i], 10) || null,
          talepNo: itemReqNos[i] || '',
          stokId: sId,
          stokKodu: itemCodes[i] || '',
          ad: itemNames[i] || '',
          talepEdilenMiktar: reqQty,
          teklifEdilenMiktar: offQty,
          birim: itemUnits[i] || 'Adet',
          birimFiyat: price,
          iskontoOrani: disc,
          kdvOrani: vat,
          iskontoTutari: discAmt,
          kdvTutari: taxAmt,
          netAmount: lineNet,
          isPrimary: i === 0
        });
      }

      const firstItem = itemsData[0] || {};
      const nextRfqNo = req.body.teklifTalepNo || req.body.rfqNo || await purchaseService.getNextRfqNo();

      await purchaseService.createRfq({
        teklifTalepNo: nextRfqNo,
        tedarikciId: supplierId,
        tedarikciAdi: supplierName,
        stokId: firstItem.stokId || 1,
        talepEdilenMiktar: firstItem.teklifEdilenMiktar || firstItem.talepEdilenMiktar || 1,
        teklifEdilenBirimFiyat: firstItem.birimFiyat || 0,
        teklifEdilenToplamFiyat: netTotal,
        araToplam: subtotal,
        toplamIskonto: totalDiscount,
        toplamKdv: totalTax,
        kalemlerVerisi: itemsData,
        paraBirimi: req.body.currency || req.body.paraBirimi || 'TRY',
        odemeVadesi: req.body.paymentTerm || req.body.odemeVadesi || 'Vadeli_30',
        teslimSuresiGun: req.body.deliveryDays || req.body.teslimSuresiGun ? parseInt(req.body.deliveryDays || req.body.teslimSuresiGun, 10) : 5,
        teslimYeri: req.body.deliveryPlace || req.body.teslimYeri || 'Ana Hammadde & Üretim Ambarı',
        kdvDurumu: isVatIncluded ? 'Dahil' : 'Hariç',
        gecerlilikBitis: req.body.validUntil || req.body.gecerlilikBitis || null,
        teklifTalepTarihi: req.body.rfqDate || req.body.teklifTalepTarihi || new Date().toISOString().split('T')[0],
        durum: 'Received',
        talepEden: req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi,
        notlar: req.body.notes || req.body.notlar || null
      }, req.user, req.ip);

      res.redirect('/purchase/rfq?success=created');
    } catch (err) {
      console.error('addRfq Error:', err);
      const nextRfqNo = await purchaseService.getNextRfqNo();
      const suppliers = await Tedarikci.findAll({ where: { durum: 'Active' }, order: [['firmaAdi', 'ASC']] });
      const requisitions = await SatinAlmaTalebi.findAll({
        where: { durum: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
        include: [{ model: StokKarti, as: 'stokKarti', include: [{ model: Tedarikci, as: 'tedarikciKarti' }] }],
        order: [['createdAt', 'DESC']]
      });

      const availableRequisitions = requisitions.map(r => ({
        id: r.id,
        requisitionNo: r.talepNo,
        stockItemId: r.stokId,
        stockCode: r.stokKarti ? r.stokKarti.stokKodu : '',
        name: r.stokKarti ? r.stokKarti.ad : '',
        category: r.stokKarti ? r.stokKarti.kategori : 'Hammadde',
        unit: r.birim || (r.stokKarti ? r.stokKarti.birim : 'Adet'),
        requestedQuantity: parseFloat(r.talepEdilenMiktar) || 0,
        purchasePrice: parseFloat(r.stokKarti ? r.stokKarti.alisFiyati : 0) || 0,
        deliveryPlace: r.girisDeposu || (r.stokKarti ? r.stokKarti.depoLokasyonu : '') || 'Ana Hammadde & Üretim Ambarı',
        supplierId: r.stokKarti?.tedarikciId || (r.stokKarti?.tedarikciKarti ? r.stokKarti.tedarikciKarti.id : null),
        supplierName: r.stokKarti?.tedarikciKarti?.firmaAdi || r.stokKarti?.tedarikci || '',
        taxNo: r.stokKarti?.tedarikciKarti?.vergiNo || '',
        taxOffice: r.stokKarti?.tedarikciKarti?.vergiDairesi || '',
        contactPerson: r.stokKarti?.tedarikciKarti?.ilgiliKisi || '',
        currency: r.stokKarti?.tedarikciKarti?.paraBirimi || (r.stokKarti ? r.stokKarti.paraBirimi : 'TRY'),
        leadTime: r.stokKarti?.tedarikciKarti?.terminSuresi || 5,
        paymentTerm: r.stokKarti?.tedarikciKarti?.odemeVadesi || 'Vadeli_30',
        urgency: r.aciliyet || 'Normal',
        createdAt: r.createdAt
      }));

      const warehouses = await Depo.findAll({ where: { durum: 'Active' }, order: [['ad', 'ASC']] });

      res.render('purchase/rfq_add', {
        user: req.user,
        error: err.message,
        nextRfqNo,
        suppliers,
        availableRequisitions,
        primaryRequisition: requisitions[0] || null,
        defaultSupplier: suppliers[0] || null,
        defaultDeliveryPlace: 'Ana Hammadde & Üretim Ambarı',
        warehouses,
        formData: req.body
      });
    }
  });

  viewRfqPdf = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const rfq = await rfqRepository.findById(id);
    if (!rfq) {
      return res.status(404).send('Teklif kaydı bulunamadı.');
    }
    const rfqObj = rfq.toJSON ? rfq.toJSON() : rfq;
    const liveRates = await currencyService.getLiveRates();
    const curr = (rfqObj.paraBirimi || 'TRY').toUpperCase();
    
    const isAccepted = rfqObj.durum === 'Accepted';
    const isRateLocked = isAccepted && !!rfqObj.kilitliDovizKuru;
    const currentRate = isRateLocked ? parseFloat(rfqObj.kilitliDovizKuru) : (liveRates[curr] || 1.0);
    const totalPriceTRY = isRateLocked && rfqObj.kilitliToplamTRY
      ? parseFloat(rfqObj.kilitliToplamTRY)
      : currencyService.convertToTRY(rfqObj.teklifEdilenToplamFiyat, curr, liveRates);

    const rfqData = {
      ...rfqObj,
      rfqNo: rfqObj.teklifTalepNo || rfqObj.rfqNo,
      supplierName: rfqObj.tedarikciAdi || (rfqObj.tedarikci ? (rfqObj.tedarikci.ticariAd || rfqObj.tedarikci.firmaAdi) : 'Tedarikçi'),
      supplierCode: rfqObj.tedarikci ? rfqObj.tedarikci.tedarikciKodu : '',
      supplierRating: rfqObj.tedarikci ? (parseFloat(rfqObj.tedarikci.performansSkoru) || 85) : 85,
      supplierTaxNo: rfqObj.tedarikci ? rfqObj.tedarikci.vergiNo : '',
      supplierTaxOffice: rfqObj.tedarikci ? rfqObj.tedarikci.vergiDairesi : '',
      supplierCity: rfqObj.tedarikci ? rfqObj.tedarikci.sehir : '',
      deliveryDays: rfqObj.teslimSuresiGun || 5,
      deliveryPlace: rfqObj.teslimYeri || 'Ana Hammadde & Üretim Ambarı',
      paymentTerm: rfqObj.odemeVadesi || 'Vadeli_30',
      vatStatus: rfqObj.kdvDurumu || 'Hariç',
      currency: curr,
      subtotal: parseFloat(rfqObj.araToplam || 0),
      discount: parseFloat(rfqObj.toplamIskonto || 0),
      vat: parseFloat(rfqObj.toplamKdv || 0),
      totalPrice: parseFloat(rfqObj.teklifEdilenToplamFiyat || 0),
      totalPriceTRY,
      exchangeRate: currentRate,
      isRateLocked,
      itemsData: rfqObj.kalemlerVerisi || [],
      notes: rfqObj.notlar || '',
      status: rfqObj.durum || 'Received',
      validUntil: rfqObj.gecerlilikBitis || '',
      supplier: rfqObj.tedarikci || {}
    };

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${rfqData.rfqNo || 'teklif'}.pdf"`);
    rfqPdfService.generatePdf(rfqData, res);
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

      // Backend Validasyonları - Temel Zorunlu Alanlar
      if (!tedarikciKodu) throw new Error('Tedarikçi kodu zorunludur.');
      if (!firmaAdi || firmaAdi.length < 2) throw new Error('Firma resmi unvanı zorunludur (en az 2 karakter).');
      if (!vergiDairesi) throw new Error('Vergi dairesi alanı zorunludur.');
      if (!vergiNo || !/^[0-9]{10,11}$/.test(vergiNo.replace(/[\s-]/g, ''))) {
        throw new Error('Vergi numarası zorunludur ve 10 haneli (Tüzel Kişi) veya 11 haneli (Şahıs) rakamlardan oluşmalıdır.');
      }
      if (!eposta || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eposta)) {
        throw new Error('E-posta adresi zorunludur ve geçerli bir e-posta formatında olmalıdır (örn: siparis@firma.com).');
      }
      if (isNaN(terminSuresi) || terminSuresi < 1) throw new Error('Varsayılan termin süresi zorunludur ve en az 1 gün olmalıdır.');

      // Yeni tedarikçi için başlangıç otomatik performans puanı (85.0)
      const baslangicSkoru = 85.0;

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
        performansSkoru: baslangicSkoru,
        kaliteSkoru: baslangicSkoru,
        zamanindaTeslimatOrani: 90.0,
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
