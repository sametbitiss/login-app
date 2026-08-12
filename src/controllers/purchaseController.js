const purchaseService = require('../services/purchaseService');
const stockService = require('../services/stockService');
const requisitionRepository = require('../repositories/requisitionRepository');
const supplierRepository = require('../repositories/supplierRepository');
const rfqRepository = require('../repositories/rfqRepository');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const asyncHandler = require('../utils/asyncHandler');
const { StockItem, PurchaseOrder, Supplier, PurchaseRequisition } = require('../../models');
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

    res.render('purchase/list', {
      user: req.user,
      orders,
      stats,
      filterSearch: search || '',
      filterStatus: status || '',
      filterPaymentTerm: paymentTerm || ''
    });
  });

  renderAddOrder = asyncHandler(async (req, res) => {
    const nextOrderNo = await purchaseService.getNextOrderNo();
    const stockItems = await StockItem.findAll({
      where: { status: 'Active' },
      order: [['name', 'ASC']]
    });
    const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });

    let formData = {};
    if (req.query.rfqId) {
      const rfq = await rfqRepository.findById(req.query.rfqId);
      if (rfq) {
        const firstItem = (rfq.itemsData && Array.isArray(rfq.itemsData) && rfq.itemsData[0]) ? rfq.itemsData[0] : null;

        const expectedDate = new Date();
        if (rfq.deliveryDays) {
          expectedDate.setDate(expectedDate.getDate() + parseInt(rfq.deliveryDays, 10));
        } else {
          expectedDate.setDate(expectedDate.getDate() + 7);
        }

        let supplierTaxNo = '';
        let supplierContactPerson = '';
        if (rfq.supplier) {
          supplierTaxNo = rfq.supplier.taxNo || '';
          supplierContactPerson = rfq.supplier.contactPerson || '';
        }

        formData = {
          rfqId: rfq.id,
          supplierId: rfq.supplierId,
          supplierName: rfq.supplierName,
          supplierTaxNo,
          supplierContactPerson,
          stockItemId: firstItem ? firstItem.stockItemId : rfq.stockItemId,
          quantity: firstItem ? firstItem.quantity : rfq.requestedQuantity,
          unitPrice: firstItem ? firstItem.unitPrice : rfq.offeredUnitPrice,
          paymentTerm: rfq.paymentTerm || 'Pesin',
          currency: rfq.currency || 'TRY',
          expectedDeliveryDate: expectedDate.toISOString().split('T')[0],
          notes: `[Sözleşmeli Teklif No: ${rfq.rfqNo}] ${rfq.notes || ''}`
        };
      }
    }

    res.render('purchase/add', {
      user: req.user,
      error: null,
      nextOrderNo,
      stockItems,
      suppliers,
      formData
    });
  });

  addOrder = asyncHandler(async (req, res) => {
    try {
      const data = {
        orderNo: req.body.orderNo ? req.body.orderNo.trim() : '',
        supplierName: req.body.supplierName ? req.body.supplierName.trim() : '',
        supplierId: req.body.supplierId ? parseInt(req.body.supplierId, 10) : null,
        supplierTaxNo: req.body.supplierTaxNo && req.body.supplierTaxNo.trim() ? req.body.supplierTaxNo.trim() : null,
        supplierContactPerson: req.body.supplierContactPerson && req.body.supplierContactPerson.trim() ? req.body.supplierContactPerson.trim() : null,
        supplierEmail: req.body.supplierEmail && req.body.supplierEmail.trim() ? req.body.supplierEmail.trim() : null,
        supplierPhone: req.body.supplierPhone && req.body.supplierPhone.trim() ? req.body.supplierPhone.trim() : null,
        orderDate: req.body.orderDate || new Date().toISOString().split('T')[0],
        expectedDeliveryDate: req.body.expectedDeliveryDate || null,
        paymentTerm: req.body.paymentTerm || 'Pesin',
        status: req.body.status || 'Pending_Approval',
        priority: req.body.priority || 'Normal',
        stockItemId: parseInt(req.body.stockItemId, 10),
        quantity: parseFloat(req.body.quantity) || 1,
        unitPrice: parseFloat(req.body.unitPrice) || 0,
        discountRate: parseFloat(req.body.discountRate) || 0,
        taxRate: parseFloat(req.body.taxRate) || 20,
        currency: req.body.currency || 'TRY',
        deliveryWarehouse: req.body.deliveryWarehouse && req.body.deliveryWarehouse.trim() ? req.body.deliveryWarehouse.trim() : null,
        purchasingAgent: req.body.purchasingAgent && req.body.purchasingAgent.trim() ? req.body.purchasingAgent.trim() : (req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username),
        notes: req.body.notes && req.body.notes.trim() ? req.body.notes.trim() : null
      };

      await purchaseService.createOrder(data, req.user, req.ip);

      // Now update RFQ status to Accepted ONLY AFTER order is created
      if (req.body.rfqId) {
        try {
          await purchaseService.acceptRfq(parseInt(req.body.rfqId, 10), req.user, req.ip);
        } catch (e) {
          console.error('acceptRfq in addOrder error:', e);
        }
      }

      res.redirect('/purchase/orders');
    } catch (err) {
      const nextOrderNo = await purchaseService.getNextOrderNo();
      const stockItems = await StockItem.findAll({
        where: { status: 'Active' },
        order: [['name', 'ASC']]
      });
      const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });

      res.render('purchase/add', {
        user: req.user,
        error: err.message || 'Satın alma siparişi oluşturulurken bir hata oluştu.',
        nextOrderNo,
        stockItems,
        suppliers,
        formData: req.body
      });
    }
  });

  renderEditOrder = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const order = await purchaseService.getOrderById(id);
    const stockItems = await StockItem.findAll({
      where: { status: 'Active' },
      order: [['name', 'ASC']]
    });
    const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });

    res.render('purchase/edit', {
      user: req.user,
      order,
      stockItems,
      suppliers,
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

      await purchaseService.updateOrder(id, {
        supplierName: req.body.supplierName ? req.body.supplierName.trim() : '',
        supplierId: req.body.supplierId ? parseInt(req.body.supplierId, 10) : null,
        supplierTaxNo: req.body.supplierTaxNo || null,
        supplierContactPerson: req.body.supplierContactPerson || null,
        supplierEmail: req.body.supplierEmail || null,
        supplierPhone: req.body.supplierPhone || null,
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
        notes: req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/orders');
    } catch (err) {
      const order = await purchaseService.getOrderById(id);
      const stockItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });
      const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });

      res.render('purchase/edit', {
        user: req.user,
        order,
        stockItems,
        suppliers,
        error: err.message || 'Sipariş güncellenirken hata oluştu.'
      });
    }
  });

  viewOrderDetail = asyncHandler(async (req, res) => {
    const order = await purchaseService.getOrderById(req.params.id);
    res.render('purchase/order_detail', {
      user: req.user,
      order
    });
  });

  // ═══════════════════════ REQUISITIONS ═══════════════════════
  listRequisitions = asyncHandler(async (req, res) => {
    const { search, status, sourceModule } = req.query;
    const requisitions = await purchaseService.getAllRequisitions({ status, sourceModule });

    res.render('purchase/requisitions', {
      user: req.user,
      requisitions,
      filterSearch: search || '',
      filterStatus: status || '',
      filterSourceModule: sourceModule || ''
    });
  });

  renderAddRequisition = asyncHandler(async (req, res) => {
    const nextReqNo = await purchaseService.getNextRequisitionNo();
    const stockItems = await StockItem.findAll({
      where: { status: 'Active' },
      order: [['name', 'ASC']]
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
        requisitionNo: req.body.requisitionNo,
        sourceModule: req.body.sourceModule || 'Manual',
        stockItemId: parseInt(req.body.stockItemId, 10),
        requestedQuantity: parseFloat(req.body.requestedQuantity) || 1,
        unit: req.body.unit || 'Adet',
        urgency: req.body.urgency || 'Normal',
        status: 'Pending',
        requesterName: req.body.requesterName || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username),
        notes: req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/requisitions');
    } catch (err) {
      const nextReqNo = await purchaseService.getNextRequisitionNo();
      const stockItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });

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
      const stockItem = reqItem.stockItem;

      await purchaseService.createOrder({
        orderNo: nextOrderNo,
        supplierName: stockItem ? (stockItem.supplier || 'Ana Tedarikçi A.Ş.') : 'Genel Tedarikçi A.Ş.',
        orderDate: new Date().toISOString().split('T')[0],
        paymentTerm: 'Vadeli_30',
        status: 'Ordered',
        priority: reqItem.urgency === 'Urgent' ? 'Urgent' : 'Normal',
        stockItemId: reqItem.stockItemId,
        quantity: parseFloat(reqItem.requestedQuantity) || 1,
        unitPrice: stockItem ? parseFloat(stockItem.purchasePrice) || 10 : 10,
        taxRate: 20,
        currency: stockItem ? stockItem.currency || 'TRY' : 'TRY',
        notes: `[Talep No: ${reqItem.requisitionNo}] ${reqItem.sourceModule} Modülünden gelen talep doğrultusunda oluşturuldu.`,
        purchasingAgent: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username
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

    // Group RFQs by product (stockItemId)
    const groupedMap = new Map();

    rfqs.forEach(rfq => {
      let productsInRfq = [];

      if (rfq.itemsData && Array.isArray(rfq.itemsData) && rfq.itemsData.length > 0) {
        rfq.itemsData.forEach(item => {
          if (item.stockItemId) {
            productsInRfq.push({
              stockItemId: parseInt(item.stockItemId, 10),
              stockCode: item.stockCode || 'STK-000',
              itemName: item.productName || 'Belirtilmemiş Ürün',
              unit: item.unit || 'Adet',
              unitPrice: parseFloat(item.unitPrice) || 0,
              quantity: parseFloat(item.quantity) || 1
            });
          }
        });
      }

      // If no itemsData array, fallback to primary stockItem association
      if (productsInRfq.length === 0 && rfq.stockItemId) {
        productsInRfq.push({
          stockItemId: parseInt(rfq.stockItemId, 10),
          stockCode: rfq.stockItem ? rfq.stockItem.stockCode : 'GENEL-000',
          itemName: rfq.stockItem ? rfq.stockItem.name : 'Genel Malzeme',
          unit: rfq.stockItem ? rfq.stockItem.unit : 'Adet',
          unitPrice: parseFloat(rfq.offeredUnitPrice) || 0,
          quantity: parseFloat(rfq.requestedQuantity) || 1
        });
      }

      // Add RFQ to each product group map
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

    // Price / Performance algorithm for each product group
    groupedRfqs.forEach(group => {
      const validOffers = group.items.filter(o => o.itemUnitPrice && parseFloat(o.itemUnitPrice) > 0);

      if (validOffers.length > 0) {
        const prices = validOffers.map(o => parseFloat(o.itemUnitPrice));
        const minPrice = Math.min(...prices);

        const daysList = validOffers.map(o => parseInt(o.deliveryDays, 10) || 7);
        const minDeliveryDays = Math.min(...daysList);

        validOffers.forEach(o => {
          const unitPrice = parseFloat(o.itemUnitPrice) || 1;
          const priceScore = minPrice > 0 ? (minPrice / unitPrice) * 100 : 50;

          const days = parseInt(o.deliveryDays, 10) || 7;
          const deliveryScore = minDeliveryDays > 0 ? Math.min(100, Math.max(30, (minDeliveryDays / days) * 100)) : 70;

          const supplierRating = o.supplier ? (parseFloat(o.supplier.performanceScore) || parseFloat(o.supplier.qualityScore) || 85) : 85;

          let termBonus = 0;
          if (o.paymentTerm === 'Vadeli_90') termBonus = 15;
          else if (o.paymentTerm === 'Vadeli_60') termBonus = 10;
          else if (o.paymentTerm === 'Vadeli_30') termBonus = 5;

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

    // Fetch products for which a PurchaseRequisition exists
    let requisitions = [];
    try {
      requisitions = await PurchaseRequisition.findAll({
        where: { status: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
        include: [{ model: StockItem, as: 'stockItem' }],
        order: [['createdAt', 'DESC']]
      });
    } catch (e) {
      console.error('Error fetching requisitions in renderAddRfq:', e);
    }

    const reqMap = new Map();
    requisitions.forEach(reqItem => {
      if (reqItem.stockItem && !reqMap.has(reqItem.stockItem.id)) {
        const minStockVal = parseFloat(reqItem.stockItem.minStock) || 10;
        reqMap.set(reqItem.stockItem.id, {
          stockItemId: reqItem.stockItem.id,
          stockCode: reqItem.stockItem.stockCode,
          name: reqItem.stockItem.name,
          category: reqItem.stockItem.category,
          unit: reqItem.stockItem.unit || 'Adet',
          minStock: minStockVal > 0 ? minStockVal : 10,
          purchasePrice: parseFloat(reqItem.stockItem.purchasePrice) || 0,
          requisitionNo: reqItem.requisitionNo,
          requisitionId: reqItem.id,
          requestedQuantity: parseFloat(reqItem.requestedQuantity) || minStockVal || 10
        });
      }
    });

    let requisitionedProducts = Array.from(reqMap.values());

    // Fallback: If no requisitions exist in DB, load active stock items so the page ALWAYS opens smoothly!
    if (requisitionedProducts.length === 0) {
      const allItems = await StockItem.findAll({ where: { status: 'Active' }, order: [['name', 'ASC']] });
      requisitionedProducts = allItems.map(item => {
        const minStockVal = parseFloat(item.minStock) || 10;
        return {
          stockItemId: item.id,
          stockCode: item.stockCode,
          name: item.name,
          category: item.category,
          unit: item.unit || 'Adet',
          minStock: minStockVal > 0 ? minStockVal : 10,
          purchasePrice: parseFloat(item.purchasePrice) || 0,
          requisitionNo: 'TAL-GENEL',
          requisitionId: 0,
          requestedQuantity: minStockVal || 10
        };
      });
    }

    const targetReqId = req.query.requisitionId ? parseInt(req.query.requisitionId, 10) : null;

    res.render('purchase/rfq_add', {
      user: req.user,
      error: null,
      nextRfqNo,
      suppliers,
      requisitionedProducts,
      targetReqId,
      formData: {}
    });
  });

  addRfq = asyncHandler(async (req, res) => {
    try {
      const supplierId = req.body.supplierId ? parseInt(req.body.supplierId, 10) : null;
      let supplierName = req.body.supplierName ? req.body.supplierName.trim() : '';

      if (supplierId) {
        const supObj = await Supplier.findByPk(supplierId);
        if (supObj) supplierName = supObj.companyName;
      }

      // Parse line items
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
            stockItemId: sId,
            stockCode: req.body.itemStockCode[i] || '',
            productName: req.body.itemProductName[i] || '',
            requisitionNo: req.body.itemRequisitionNo[i] || '',
            quantity: qty,
            unit: req.body.itemUnit[i] || 'Adet',
            unitPrice: price,
            discountRate: disc,
            vatRate: vat,
            netAmount: net,
            notes: req.body.itemNotes ? (req.body.itemNotes[i] || '') : ''
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
            stockItemId: sId,
            stockCode: req.body.itemStockCode || '',
            productName: req.body.itemProductName || '',
            requisitionNo: req.body.itemRequisitionNo || '',
            quantity: qty,
            unit: req.body.itemUnit || 'Adet',
            unitPrice: price,
            discountRate: disc,
            vatRate: vat,
            netAmount: net,
            notes: req.body.itemNotes || ''
          });
        }
      }

      const subtotal = parseFloat(req.body.subtotal) || 0;
      const totalDiscount = parseFloat(req.body.totalDiscount) || 0;
      const totalTax = parseFloat(req.body.totalTax) || 0;
      const offeredTotalPrice = parseFloat(req.body.offeredTotalPrice) || (subtotal - totalDiscount + totalTax);

      const firstItem = itemsData[0] || {};

      await purchaseService.createRfq({
        rfqNo: req.body.rfqNo,
        supplierId,
        supplierName,
        stockItemId: firstItem.stockItemId || 1,
        requestedQuantity: firstItem.quantity || 1,
        offeredUnitPrice: firstItem.unitPrice || 0,
        offeredTotalPrice,
        subtotal,
        totalDiscount,
        totalTax,
        itemsData,
        currency: req.body.currency || 'TRY',
        paymentTerm: req.body.paymentTerm || 'Pesin',
        deliveryDays: req.body.deliveryDays ? parseInt(req.body.deliveryDays, 10) : null,
        deliveryPlace: req.body.deliveryPlace || null,
        shippingStatus: req.body.shippingStatus || null,
        vatStatus: req.body.vatStatus || null,
        documentRef: req.body.documentRef || null,
        validUntil: req.body.validUntil || null,
        rfqDate: req.body.rfqDate || new Date().toISOString().split('T')[0],
        status: req.body.status || 'Received',
        requestedBy: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username,
        notes: req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/rfq');
    } catch (err) {
      console.error('addRfq Error:', err);
      const nextRfqNo = await purchaseService.getNextRfqNo();
      const suppliers = await purchaseService.getAllSuppliers({ status: 'Active' });
      const requisitions = await PurchaseRequisition.findAll({
        where: { status: { [Op.in]: ['Pending', 'Approved', 'Ordered'] } },
        include: [{ model: StockItem, as: 'stockItem' }]
      });

      const reqMap = new Map();
      requisitions.forEach(reqItem => {
        if (reqItem.stockItem && !reqMap.has(reqItem.stockItem.id)) {
          const minStockVal = parseFloat(reqItem.stockItem.minStock) || 10;
          reqMap.set(reqItem.stockItem.id, {
            stockItemId: reqItem.stockItem.id,
            stockCode: reqItem.stockItem.stockCode,
            name: reqItem.stockItem.name,
            category: reqItem.stockItem.category,
            unit: reqItem.stockItem.unit || 'Adet',
            minStock: minStockVal > 0 ? minStockVal : 10,
            purchasePrice: parseFloat(reqItem.stockItem.purchasePrice) || 0,
            requisitionNo: reqItem.requisitionNo,
            requisitionId: reqItem.id,
            requestedQuantity: parseFloat(reqItem.requestedQuantity) || minStockVal || 10
          });
        }
      });

      res.render('purchase/rfq_add', {
        user: req.user,
        error: err.message || 'Teklif kaydedilirken hata oluştu.',
        nextRfqNo,
        suppliers,
        requisitionedProducts: Array.from(reqMap.values()),
        targetReqId: null,
        formData: req.body
      });
    }
  });

  acceptRfq = asyncHandler(async (req, res) => {
    await purchaseService.acceptRfq(req.params.id, req.user, req.ip);
    res.redirect('/purchase/rfq');
  });

  rejectRfq = asyncHandler(async (req, res) => {
    await purchaseService.updateRfq(req.params.id, { status: 'Rejected' }, req.user, req.ip);
    res.redirect('/purchase/rfq');
  });

  // ═══════════════════════ SUPPLIERS ═══════════════════════
  listSuppliers = asyncHandler(async (req, res) => {
    const { search, status, category } = req.query;
    const suppliers = await purchaseService.getAllSuppliers({ search, status, category });
    const supplierStats = await purchaseService.getSupplierStats();

    res.render('purchase/suppliers', {
      user: req.user,
      suppliers,
      supplierStats,
      filterSearch: search || '',
      filterStatus: status || '',
      filterCategory: category || ''
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
    try {
      await purchaseService.createSupplier({
        supplierCode: req.body.supplierCode ? req.body.supplierCode.trim() : '',
        companyName: req.body.companyName ? req.body.companyName.trim() : '',
        taxNo: req.body.taxNo || null,
        taxOffice: req.body.taxOffice || null,
        contactPerson: req.body.contactPerson || null,
        email: req.body.email || null,
        phone: req.body.phone || null,
        fax: req.body.fax || null,
        website: req.body.website || null,
        address: req.body.address || null,
        city: req.body.city || null,
        country: req.body.country || 'Türkiye',
        paymentTerm: req.body.paymentTerm || 'Vadeli_30',
        currency: req.body.currency || 'TRY',
        riskLimit: parseFloat(req.body.riskLimit) || 100000,
        category: req.body.category || 'Hammadde',
        status: 'Active',
        notes: req.body.notes || null
      }, req.user, req.ip);

      res.redirect('/purchase/suppliers');
    } catch (err) {
      const nextCode = await purchaseService.getNextSupplierCode();

      res.render('purchase/supplier_add', {
        user: req.user,
        error: err.message || 'Tedarikçi eklenirken hata oluştu.',
        nextCode,
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

  // ═══════════════════════ GOODS RECEIPT ═══════════════════════
  listGoodsReceipts = asyncHandler(async (req, res) => {
    const { search, status, qualityStatus } = req.query;
    const receipts = await purchaseService.getAllGoodsReceipts({ search, status, qualityStatus });
    const grnStats = await purchaseService.getGoodsReceiptStats();

    res.render('purchase/goods_receipt', {
      user: req.user,
      receipts,
      grnStats,
      filterSearch: search || '',
      filterStatus: status || '',
      filterQualityStatus: qualityStatus || ''
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
      const receivedQty = parseFloat(req.body.receivedQuantity) || 0;
      const acceptedQty = parseFloat(req.body.acceptedQuantity) || receivedQty;
      const rejectedQty = receivedQty - acceptedQty;

      await purchaseService.createGoodsReceipt({
        grnNo: req.body.grnNo,
        purchaseOrderId: parseInt(req.body.purchaseOrderId, 10),
        supplierId: req.body.supplierId ? parseInt(req.body.supplierId, 10) : null,
        stockItemId: parseInt(req.body.stockItemId, 10),
        orderedQuantity: parseFloat(req.body.orderedQuantity) || 0,
        receivedQuantity: receivedQty,
        acceptedQuantity: acceptedQty,
        rejectedQuantity: rejectedQty > 0 ? rejectedQty : 0,
        receiptDate: req.body.receiptDate || new Date().toISOString().split('T')[0],
        deliveryNoteNo: req.body.deliveryNoteNo || null,
        qualityStatus: req.body.qualityStatus || 'Approved',
        inspectorName: req.body.inspectorName || (req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username),
        qualityNotes: req.body.qualityNotes || null,
        warehouseLocation: req.body.warehouseLocation || null,
        status: acceptedQty >= parseFloat(req.body.orderedQuantity) ? 'Completed' : 'Partial',
        notes: req.body.notes || null
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
  });
}

module.exports = new PurchaseController();
