const stockRepository = require('../repositories/stockRepository');
const stockValuationService = require('../services/stockValuationService');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('../services/purchaseService');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const salesRepository = require('../repositories/saleRepository');
const requisitionRepository = require('../repositories/requisitionRepository');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');
const { GoodsReceipt, PurchaseOrder, StockItem, StockMovement, Supplier, Warehouse } = require('../../models');

const CATEGORIES = [
  { value: 'Hammadde', label: 'Hammadde' },
  { value: 'Yari_Mamul', label: 'Yarı Mamul' },
  { value: 'Mamul', label: 'Mamul' },
  { value: 'Ticari_Mal', label: 'Ticari Mal' },
  { value: 'Diger', label: 'Diğer' }
];

class StockController {
  // 0. STOCK ANALYTICS DASHBOARD
  showAnalytics = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();
    const stats = await stockRepository.getStats();
    const warehouses = await stockRepository.findAllWarehouses();
    const lowStockItems = await stockRepository.getLowStockAlerts();
    const valuationReport = await stockValuationService.calculateValuation();
    const movements = await stockRepository.findAllMovements();

    res.render('stock/analytics', {
      user: req.user,
      stockItems,
      stats,
      warehouses,
      lowStockItems,
      valuationReport,
      movements: movements.slice(0, 5),
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'analytics'
    });
  });

  // 1. STOCK ITEMS MANAGEMENT
  listItems = asyncHandler(async (req, res) => {
    const { search, category, status } = req.query;
    const stockItems = await stockRepository.findAll({ search, category, status });
    const stats = await stockRepository.getStats();

    let successMsg = null;
    if (req.query.success === 'purchase') {
      successMsg = '🛒 Satın Alma Talebi başarıyla oluşturuldu ve Satın Alma Modülüne (Talepler Kartına) iletildi.';
    } else if (req.query.success === 'production') {
      successMsg = '⚙️ Üretim Talebi başarıyla oluşturuldu ve Üretim Modülüne (Talepler Kartına) iletildi.';
    }

    res.render('stock/list', {
      user: req.user,
      stockItems,
      stats,
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'items',
      filterSearch: search || '',
      filterCategory: category || '',
      filterStatus: status || '',
      successMsg
    });
  });

  renderAdd = asyncHandler(async (req, res) => {
    const nextStockCode = await stockRepository.getNextStockCode();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/add', {
      user: req.user,
      nextStockCode,
      nextCode: nextStockCode,
      warehouses,
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'items',
      formData: {},
      error: null
    });
  });

  addItem = asyncHandler(async (req, res) => {
    try {
      const nextStockCode = await stockRepository.getNextStockCode();
      let category = req.body.category || 'Ticari_Mal';
      if (category === 'Yarı_Mamul') category = 'Yari_Mamul';

      const barcode = req.body.barcode && req.body.barcode.trim() !== '' ? req.body.barcode.trim() : null;
      const brand = req.body.brand && req.body.brand.trim() !== '' ? req.body.brand.trim() : null;
      const model = req.body.model && req.body.model.trim() !== '' ? req.body.model.trim() : null;
      const description = req.body.description && req.body.description.trim() !== '' ? req.body.description.trim() : null;
      const warehouseLocation = req.body.warehouseLocation && req.body.warehouseLocation.trim() !== '' ? req.body.warehouseLocation.trim() : null;
      const supplier = req.body.supplier && req.body.supplier.trim() !== '' ? req.body.supplier.trim() : null;
      const notes = req.body.notes && req.body.notes.trim() !== '' ? req.body.notes.trim() : null;

      await stockRepository.create({
        ...req.body,
        category,
        barcode,
        brand,
        model,
        description,
        warehouseLocation,
        supplier,
        notes,
        stockCode: nextStockCode,
        currentStock: parseFloat(req.body.currentStock) || 0,
        minStock: parseFloat(req.body.minStock) || 0,
        maxStock: parseFloat(req.body.maxStock) || 0,
        purchasePrice: parseFloat(req.body.purchasePrice) || 0,
        salePrice: parseFloat(req.body.salePrice) || 0,
        taxRate: parseFloat(req.body.taxRate) || 20
      }, req.user, req.ip);

      res.redirect('/stock');
    } catch (err) {
      const nextStockCode = await stockRepository.getNextStockCode();
      const warehouses = await stockRepository.findAllWarehouses();

      let friendlyError = err.message;
      if (err.name === 'SequelizeUniqueConstraintError' || err.name === 'SequelizeValidationError') {
        if (err.errors && err.errors.length > 0) {
          friendlyError = err.errors.map(e => {
            if (e.path === 'stockCode') return 'Bu stok kodu zaten başka bir malzemede kullanılıyor.';
            if (e.path === 'barcode') return 'Bu barkod numarası zaten başka bir malzemede kullanılıyor.';
            return e.message;
          }).join(' | ');
        } else {
          friendlyError = 'Girdiğiniz stok koda veya barkod numarası zaten kullanılmaktadır.';
        }
      }

      res.render('stock/add', {
        user: req.user,
        nextStockCode,
        nextCode: nextStockCode,
        warehouses,
        CATEGORIES,
        ALL_ROLES,
        activeSubTab: 'items',
        formData: req.body,
        error: friendlyError || 'Stok kartı eklenirken bir hata oluştu.'
      });
    }
  // 1.1. STOCK ITEM DETAIL & EDIT
  getItemDetail = asyncHandler(async (req, res) => {
    const item = await stockRepository.findById(req.params.id);
    if (!item) throw new NotFoundError('Stok kalemi bulunamadı.');

    const warehouses = await stockRepository.findAllWarehouses();
    const suppliers = await Supplier.findAll({ where: { status: 'Active' }, order: [['companyName', 'ASC']] });

    res.render('stock/item_detail', {
      user: req.user,
      item,
      warehouses,
      suppliers,
      CATEGORIES,
      activeSubTab: 'items',
      successMsg: req.query.success === 'updated' ? 'Stok kartı bilgileri başarıyla güncellendi!' : null,
      errorMsg: req.query.error || null
    });
  });

  updateItem = asyncHandler(async (req, res) => {
    const item = await stockRepository.findById(req.params.id);
    if (!item) throw new NotFoundError('Stok kalemi bulunamadı.');

    try {
      await stockRepository.update(item.id, {
        name: req.body.name ? req.body.name.trim() : item.name,
        barcode: req.body.barcode ? req.body.barcode.trim() : null,
        category: req.body.category || item.category,
        procurementMethod: req.body.procurementMethod || item.procurementMethod,
        unit: req.body.unit || item.unit,
        brand: req.body.brand ? req.body.brand.trim() : null,
        model: req.body.model ? req.body.model.trim() : null,
        minStock: req.body.minStock !== undefined && req.body.minStock !== '' ? parseFloat(req.body.minStock) : 0,
        maxStock: req.body.maxStock !== undefined && req.body.maxStock !== '' ? parseFloat(req.body.maxStock) : null,
        purchasePrice: req.body.purchasePrice !== undefined && req.body.purchasePrice !== '' ? parseFloat(req.body.purchasePrice) : 0,
        salePrice: req.body.salePrice !== undefined && req.body.salePrice !== '' ? parseFloat(req.body.salePrice) : 0,
        currency: req.body.currency || 'TRY',
        taxRate: req.body.taxRate !== undefined && req.body.taxRate !== '' ? parseFloat(req.body.taxRate) : 20,
        warehouseLocation: req.body.warehouseLocation ? req.body.warehouseLocation.trim() : null,
        supplier: req.body.supplier ? req.body.supplier.trim() : null,
        status: req.body.status || 'Active',
        notes: req.body.notes ? req.body.notes.trim() : null
      }, req.user, req.ip);

      res.redirect(`/stock/items/${item.id}/detail?success=updated`);
    } catch (err) {
      let friendlyError = err.message;
      if (err.name === 'SequelizeUniqueConstraintError' || err.name === 'SequelizeValidationError') {
        if (err.errors && err.errors.length > 0) {
          friendlyError = err.errors.map(e => {
            if (e.path === 'barcode') return 'Bu barkod numarası başka bir stok kartında zaten kullanılmaktadır.';
            return e.message;
          }).join(' | ');
        }
      }
      res.redirect(`/stock/items/${item.id}/detail?error=` + encodeURIComponent(friendlyError));
    }
  });

  // 2. MULTI-WAREHOUSE & LOCATIONS
  listWarehouses = asyncHandler(async (req, res) => {
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/warehouses', {
      user: req.user,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'warehouses'
    });
  });

  addWarehouse = asyncHandler(async (req, res) => {
    const { name, type, city, address, managerName } = req.body;
    if (!name) throw new ValidationError('Depo adı zorunludur.');

    const warehouseCode = `DEP-${Math.floor(100 + Math.random() * 900)}`;
    await stockRepository.createWarehouse({
      warehouseCode,
      name,
      type: type || 'General',
      city: city || 'İstanbul',
      address,
      managerName
    }, req.user, req.ip);

    res.redirect('/stock/warehouses');
  });

  addLocation = asyncHandler(async (req, res) => {
    const { warehouseId, aisle, shelf, bin, capacity } = req.body;
    if (!warehouseId || !aisle || !shelf || !bin) {
      throw new ValidationError('Depo, Koridor, Raf ve Göz alanları zorunludur.');
    }

    const locationCode = `LOC-${warehouseId}-${aisle}-${shelf}-${bin}`;
    await stockRepository.createLocation({
      locationCode,
      warehouseId,
      aisle,
      shelf,
      bin,
      capacity: parseInt(capacity, 10) || 1000
    }, req.user, req.ip);

    res.redirect('/stock/warehouses');
  });

  // 3. LOT / BATCH & SERIAL NUMBER TRACEABILITY
  listLots = asyncHandler(async (req, res) => {
    const lots = await stockRepository.findAllLots();
    const stockItems = await stockRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/lots', {
      user: req.user,
      lots,
      stockItems,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'lots'
    });
  });

  addLot = asyncHandler(async (req, res) => {
    const { stockItemId, warehouseId, lotNumber, serialNumber, quantity, productionDate, expirationDate, qualityStatus, notes } = req.body;

    if (!stockItemId || !warehouseId || !lotNumber) {
      throw new ValidationError('Stok kalemi, depo ve lot numarası zorunludur.');
    }

    await stockRepository.createLot({
      stockItemId,
      warehouseId,
      lotNumber,
      serialNumber,
      quantity: parseFloat(quantity) || 0,
      productionDate,
      expirationDate,
      qualityStatus: qualityStatus || 'Approved',
      notes
    }, req.user, req.ip);

    res.redirect('/stock/lots');
  });

  // 4. MOVEMENTS & WAREHOUSE TRANSFERS
  listTransfers = asyncHandler(async (req, res) => {
    const movements = await stockRepository.findAllMovements();
    const stockItems = await stockRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/transfers', {
      user: req.user,
      movements,
      stockItems,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'transfers'
    });
  });

  addTransfer = asyncHandler(async (req, res) => {
    const { stockItemId, sourceWarehouseId, targetWarehouseId, quantity, notes } = req.body;

    if (!stockItemId || !sourceWarehouseId || !targetWarehouseId || !quantity) {
      throw new ValidationError('Malzeme, çıkış deposu, hedef depo ve miktar alanları zorunludur.');
    }

    await stockRepository.createTransfer({
      stockItemId,
      sourceWarehouseId,
      targetWarehouseId,
      quantity,
      notes
    }, req.user, req.ip);

    res.redirect('/stock/transfers');
  });

  // 5. GOODS RECEIPT (SATIN ALMA MAL KABUL)
  listGoodsReceipt = asyncHandler(async (req, res) => {
    // Mal kabul bekleyen veya kısmi teslim alınan tüm siparişleri getir (Received/Completed olanlar GİZLENİR!)
    const allOrders = await purchaseRepository.findAll();
    
    // Filter active orders that are ready for receipt (Pending_Approval and Received/Cancelled hidden!)
    const activeOrders = allOrders.filter(po => po.status === 'Ordered' || po.status === 'Partial_Received');

    const ordersWithDetails = await Promise.all(activeOrders.map(async (po) => {
      const receivedTotals = await goodsReceiptRepository.getReceivedTotalsForOrder(po.id);
      const pastReceipts = await goodsReceiptRepository.getReceiptsByOrderId(po.id);

      // Parse order line items
      let items = [];
      if (po.itemsJson) {
        try { items = typeof po.itemsJson === 'string' ? JSON.parse(po.itemsJson) : po.itemsJson; } catch (e) { items = []; }
      }
      if (!items || items.length === 0) {
        items = [{
          stockItemId: po.stockItemId,
          stockCode: po.stockItem ? po.stockItem.stockCode : 'STK-001',
          productName: po.stockItem ? po.stockItem.name : (po.productName || 'Ürün Kalemi'),
          quantity: po.quantity,
          unit: po.stockItem ? po.stockItem.unit : 'Adet',
          unitPrice: po.unitPrice
        }];
      }

      // Calculate total ordered, total received, remaining for each item
      let totalOrderedQty = 0;
      let totalReceivedQty = 0;
      const parsedItems = items.map(it => {
        const sId = parseInt(it.stockItemId, 10);
        const ordered = parseFloat(it.quantity) || 0;
        const rec = receivedTotals[sId] || 0;
        const rem = Math.max(0, ordered - rec);

        totalOrderedQty += ordered;
        totalReceivedQty += rec;

        return {
          ...it,
          orderedQuantity: ordered,
          receivedQuantity: rec,
          remainingQuantity: rem
        };
      });

      return {
        ...po.toJSON ? po.toJSON() : po,
        items: parsedItems,
        totalOrderedQty,
        totalReceivedQty,
        totalRemainingQty: Math.max(0, totalOrderedQty - totalReceivedQty),
        receiptCount: pastReceipts.length
      };
    }));

    const warehouses = await stockRepository.findAllWarehouses();

    let successMsg = null;
    if (req.query.success === 'receipt_created') {
      const grnNo = req.query.grnNo || '';
      successMsg = `✅ Mal kabul ve stok girişi ${grnNo ? '(' + grnNo + ') ' : ''}başarıyla kaydedildi, ilgili ürünlerin stok sayıları güncellendi.`;
    }

    res.render('stock/goods_receipt', {
      user: req.user,
      purchaseOrders: ordersWithDetails,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'goods-receipt',
      successMsg
    });
  });

  renderCreateGoodsReceipt = asyncHandler(async (req, res) => {
    const { orderId } = req.query;
    if (!orderId) throw new ValidationError('Sipariş ID belirtilmelidir.');

    const po = await PurchaseOrder.findByPk(orderId, {
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: Supplier, as: 'supplier' }
      ]
    });
    if (!po) throw new NotFoundError('Satın alma siparişi bulunamadı.');
    if (po.status === 'Pending_Approval') {
      throw new ValidationError('Bu sipariş bütçe limitini aştığı için yönetsel onay beklemektedir (Pending_Approval). Onaylanmadan mal kabul işlemi yapılamaz.');
    }

    const receivedTotals = await goodsReceiptRepository.getReceivedTotalsForOrder(po.id);
    const nextGrnNo = await goodsReceiptRepository.getNextGrnNo();
    const warehouses = await stockRepository.findAllWarehouses();

    // Parse order items
    let items = [];
    if (po.itemsJson) {
      try { items = typeof po.itemsJson === 'string' ? JSON.parse(po.itemsJson) : po.itemsJson; } catch (e) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        stockItemId: po.stockItemId,
        stockCode: po.stockItem ? po.stockItem.stockCode : 'STK-001',
        productName: po.stockItem ? po.stockItem.name : (po.productName || 'Ürün Kalemi'),
        quantity: po.quantity,
        unit: po.stockItem ? po.stockItem.unit : 'Adet',
        unitPrice: po.unitPrice
      }];
    }

    const itemsForReceipt = items.map(it => {
      const sId = parseInt(it.stockItemId, 10);
      const ordered = parseFloat(it.quantity) || 0;
      const prevRec = receivedTotals[sId] || 0;
      const remaining = Math.max(0, ordered - prevRec);

      return {
        ...it,
        stockItemId: sId,
        orderedQuantity: ordered,
        previouslyReceivedQuantity: prevRec,
        remainingQuantity: remaining,
        currentReceivedQuantity: remaining
      };
    });

    res.render('stock/goods_receipt_create', {
      user: req.user,
      order: po,
      nextGrnNo,
      items: itemsForReceipt,
      warehouses,
      error: null
    });
  });

  processGoodsReceipt = asyncHandler(async (req, res) => {
    const {
      purchaseOrderId,
      warehouseLocation,
      deliveryNoteNo,
      deliveryNoteDate,
      deliveryNotePhoto,
      notes
    } = req.body;

    const po = await PurchaseOrder.findByPk(purchaseOrderId, {
      include: [{ model: StockItem, as: 'stockItem' }]
    });
    if (!po) throw new NotFoundError('Satın alma siparişi bulunamadı.');
    if (po.status === 'Pending_Approval') {
      throw new ValidationError('Bu sipariş bütçe limitini aştığı için yönetsel onay beklemektedir (Pending_Approval). Onaylanmadan mal kabul işlemi yapılamaz.');
    }

    let itemsDataArray = [];
    const stockItemIds = Array.isArray(req.body.itemStockItemId) ? req.body.itemStockItemId : [req.body.itemStockItemId];
    const productNames = Array.isArray(req.body.itemProductName) ? req.body.itemProductName : [req.body.itemProductName];
    const stockCodes = Array.isArray(req.body.itemStockCode) ? req.body.itemStockCode : [req.body.itemStockCode];
    const orderedQtys = Array.isArray(req.body.itemOrderedQty) ? req.body.itemOrderedQty : [req.body.itemOrderedQty];
    const prevReceivedQtys = Array.isArray(req.body.itemPrevReceivedQty) ? req.body.itemPrevReceivedQty : [req.body.itemPrevReceivedQty];
    const currentReceivedQtys = Array.isArray(req.body.itemCurrentReceivedQty) ? req.body.itemCurrentReceivedQty : [req.body.itemCurrentReceivedQty];
    const units = Array.isArray(req.body.itemUnit) ? req.body.itemUnit : [req.body.itemUnit];

    let totalReceivedInThisBatch = 0;

    for (let i = 0; i < stockItemIds.length; i++) {
      const sId = parseInt(stockItemIds[i], 10);
      const ordered = parseFloat(orderedQtys[i]) || 0;
      const prevRec = parseFloat(prevReceivedQtys[i]) || 0;
      const currRec = parseFloat(currentReceivedQtys[i]) || 0;

      if (currRec > 0) {
        totalReceivedInThisBatch += currRec;
      }

      itemsDataArray.push({
        stockItemId: sId,
        stockCode: stockCodes[i] || '',
        productName: productNames[i] || '',
        unit: units[i] || 'Adet',
        orderedQuantity: ordered,
        previouslyReceivedQuantity: prevRec,
        currentReceivedQuantity: currRec,
        netRemainingQuantity: Math.max(0, ordered - (prevRec + currRec))
      });
    }

    if (totalReceivedInThisBatch <= 0) {
      throw new ValidationError('Teslim alınan miktar 0\'dan büyük olmalıdır.');
    }

    const grnNo = await goodsReceiptRepository.getNextGrnNo();

    const grn = await GoodsReceipt.create({
      grnNo,
      purchaseOrderId: po.id,
      supplierId: po.supplierId || null,
      stockItemId: itemsDataArray[0] ? itemsDataArray[0].stockItemId : null,
      orderedQuantity: itemsDataArray[0] ? itemsDataArray[0].orderedQuantity : po.quantity,
      receivedQuantity: totalReceivedInThisBatch,
      acceptedQuantity: totalReceivedInThisBatch,
      rejectedQuantity: 0,
      receiptDate: new Date().toISOString().split('T')[0],
      deliveryNoteNo: deliveryNoteNo ? deliveryNoteNo.trim() : null,
      deliveryNoteDate: deliveryNoteDate || null,
      deliveryNotePhoto: deliveryNotePhoto || null,
      itemsData: JSON.stringify(itemsDataArray),
      warehouseLocation: warehouseLocation || 'Ana Depo',
      status: 'Completed',
      qualityStatus: 'Approved',
      notes: notes || null,
      createdBy: req.user.id
    });

    for (const itemRec of itemsDataArray) {
      if (itemRec.currentReceivedQuantity > 0 && itemRec.stockItemId) {
        const stockItem = await StockItem.findByPk(itemRec.stockItemId);
        if (stockItem) {
          stockItem.currentStock = parseFloat(stockItem.currentStock) + itemRec.currentReceivedQuantity;
          await stockItem.save();

          const moveNo = `GRN-${Date.now().toString().slice(-6)}-${itemRec.stockItemId}`;
          await StockMovement.create({
            movementNo: moveNo,
            stockItemId: stockItem.id,
            targetWarehouseId: 1,
            movementType: 'Inbound',
            quantity: itemRec.currentReceivedQuantity,
            unitPrice: po.unitPrice || 0,
            referenceNo: grnNo,
            notes: `[Mal Kabul Girişi] İrsaliye No: ${deliveryNoteNo || '—'} | Fiş: ${grnNo}`,
            performedBy: req.user.id
          });
        }
      }
    }

    const receivedTotals = await goodsReceiptRepository.getReceivedTotalsForOrder(po.id);
    let orderItems = [];
    if (po.itemsJson) {
      try { orderItems = typeof po.itemsJson === 'string' ? JSON.parse(po.itemsJson) : po.itemsJson; } catch (e) { orderItems = []; }
    }
    if (!orderItems || orderItems.length === 0) {
      orderItems = [{ stockItemId: po.stockItemId, quantity: po.quantity }];
    }

    let isAllFullyReceived = true;
    for (const ordItem of orderItems) {
      const sId = parseInt(ordItem.stockItemId, 10);
      const ordQty = parseFloat(ordItem.quantity) || 0;
      const totalRec = receivedTotals[sId] || 0;
      if (totalRec < ordQty) {
        isAllFullyReceived = false;
        break;
      }
    }

    if (isAllFullyReceived) {
      await po.update({ status: 'Received' });
    } else {
      await po.update({ status: 'Partial_Received' });
    }

    res.redirect(`/stock/goods-receipt?success=receipt_created&grnNo=${encodeURIComponent(grnNo)}`);
  });

  viewGoodsReceiptHistory = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const po = await PurchaseOrder.findByPk(orderId, {
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: Supplier, as: 'supplier' }
      ]
    });
    if (!po) throw new NotFoundError('Satın alma siparişi bulunamadı.');

    const pastReceipts = await goodsReceiptRepository.getReceiptsByOrderId(orderId);

    const formattedReceipts = pastReceipts.map(gr => {
      let items = [];
      if (gr.itemsData) {
        try { items = typeof gr.itemsData === 'string' ? JSON.parse(gr.itemsData) : gr.itemsData; } catch (e) { items = []; }
      }
      return {
        ...gr.toJSON(),
        itemsList: items
      };
    });

    res.render('stock/goods_receipt_history', {
      user: req.user,
      order: po,
      receipts: formattedReceipts
    });
  });

  confirmGoodsReceipt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    res.redirect(`/stock/goods-receipt/create?orderId=${id}`);
  });

  // 6. DISPATCH (SATIŞ SEVKİYAT VE ÇIKIŞ)
  listDispatch = asyncHandler(async (req, res) => {
    const salesOrders = await salesRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/dispatch', {
      user: req.user,
      salesOrders,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'dispatch'
    });
  });

  confirmDispatch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await salesRepository.updateStatus(id, 'Completed', req.user, req.ip);
    res.redirect('/stock/dispatch');
  });

  // 7. INVENTORY COUNTING & RECONCILIATION
  listCounting = asyncHandler(async (req, res) => {
    const countings = await stockRepository.findAllCountings();
    const stockItems = await stockRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/counting', {
      user: req.user,
      countings,
      stockItems,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'counting'
    });
  });

  addCounting = asyncHandler(async (req, res) => {
    const { warehouseId, countDate, notes } = req.body;
    if (!warehouseId) throw new ValidationError('Depo seçimi zorunludur.');

    await stockRepository.createCounting({
      warehouseId,
      countDate,
      notes
    }, req.user, req.ip);

    res.redirect('/stock/counting');
  });

  // 8. CRITICAL STOCK & MIN/MAX ALERTS
  listAlerts = asyncHandler(async (req, res) => {
    const lowStockItems = await stockRepository.getLowStockAlerts();
    const requisitions = await requisitionRepository.findAll({ sourceModule: 'Stock' });

    const { PurchaseRequisition, ProductionOrder } = require('../../models');
    const { Op } = require('sequelize');

    // Fetch active/pending purchase requisitions
    const pendingPurchaseReqs = await PurchaseRequisition.findAll({
      where: {
        status: { [Op.in]: ['Pending', 'Approved'] }
      }
    });

    // Fetch active/pending production orders
    const pendingProductionOrders = await ProductionOrder.findAll({
      where: {
        status: { [Op.in]: ['Planned', 'In_Production', 'Quality_Check'] }
      }
    });

    const pendingPurchaseStockItemIds = new Set(pendingPurchaseReqs.map(r => parseInt(r.stockItemId, 10)));
    const pendingProductionStockItemIds = new Set(pendingProductionOrders.map(o => parseInt(o.stockItemId, 10)));

    lowStockItems.forEach(item => {
      item.hasPendingPurchaseReq = pendingPurchaseStockItemIds.has(item.id);
      item.hasPendingProductionOrder = pendingProductionStockItemIds.has(item.id);
    });

    let successMsg = null;
    if (req.query.success === 'purchase') {
      successMsg = '🛒 Satın Alma Talebi başarıyla oluşturuldu ve Satın Alma Modülüne (Talepler Kartına) iletildi.';
    } else if (req.query.success === 'production') {
      successMsg = '⚙️ Üretim Talebi / İş Emri başarıyla oluşturuldu ve Üretim Planlama Modülüne (Talepler Kartına) iletildi.';
    } else if (req.query.success === 'true') {
      successMsg = 'Talebiniz başarıyla ilgili modüle iletildi.';
    }

    res.render('stock/alerts', {
      user: req.user,
      lowStockItems,
      requisitions,
      ALL_ROLES,
      activeSubTab: 'alerts',
      successMsg
    });
  });

  createStockRequisition = asyncHandler(async (req, res) => {
    const { stockItemId, requestedQuantity, urgency, notes, targetModule, redirectUrl } = req.body;

    if (!stockItemId) {
      throw new ValidationError('Malzeme seçimi zorunludur.');
    }

    const item = await stockRepository.findById(stockItemId);
    if (!item) {
      throw new NotFoundError('Stok kalemi bulunamadı.');
    }

    const missingAmount = parseFloat(item.minStock || 0) - parseFloat(item.currentStock || 0);
    const qty = parseFloat(requestedQuantity) || (missingAmount > 0 ? missingAmount : 10);

    const forcePurchase = (targetModule === 'purchase' || targetModule === 'Purchase' || req.body.module === 'purchase');
    const pMethod = item.procurementMethod || ((item.category === 'Mamul' || item.category === 'Yari_Mamul' || item.category === 'Yarı_Mamul') ? 'Üretim' : 'Satın Alma');
    const isProductionItem = !forcePurchase && (pMethod === 'Üretim' || pMethod === 'Production');

    if (isProductionItem) {
      const productionRepository = require('../repositories/productionRepository');
      const nextWorkOrderNo = await productionRepository.generateWorkOrderNo();

      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      await productionRepository.create({
        workOrderNo: nextWorkOrderNo,
        productionTitle: `[Kritik Stok Uyarısı] ${item.name} Üretim Talebi`,
        stockItemId: item.id,
        plannedQuantity: qty,
        unit: item.unit || 'Adet',
        status: 'Planned',
        priority: urgency === 'Urgent' ? 'Urgent' : 'High',
        workCenter: item.category === 'Mamul' ? 'Montaj İstasyonu' : 'İşleme İstasyonu',
        plannedStartDate: today.toISOString().split('T')[0],
        plannedEndDate: nextWeek.toISOString().split('T')[0],
        notes: notes || `🚨 [Kritik Stok Uyarısı] Depoda '${item.name}' ürünü kritik seviyededir (Mevcut: ${item.currentStock} ${item.unit}, Min: ${item.minStock} ${item.unit}). Tedarik Yöntemi: Üretim. Lütfen acil imalatını tamamlayın.`,
        createdBy: req.user.id
      }, req.user, req.ip);

      return res.redirect(redirectUrl || '/stock/alerts?success=production');
    } else {
      const nextReqNo = await purchaseService.getNextRequisitionNo();

      await purchaseService.createRequisition({
        requisitionNo: nextReqNo,
        sourceModule: 'Stock',
        stockItemId: item.id,
        requestedQuantity: qty,
        unit: item.unit || 'Adet',
        urgency: urgency === 'Urgent' ? 'Urgent' : (urgency === 'High' ? 'High' : 'Normal'),
        status: 'Pending',
        requesterName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username,
        notes: notes || `🚨 [Stok Modülünden Gelen Talep] Depodan '${item.name}' malzemesi için satın alma talebi oluşturulmuştur. (Mevcut: ${item.currentStock} ${item.unit}, Min: ${item.minStock} ${item.unit}).`,
        createdBy: req.user.id
      }, req.user, req.ip);

      return res.redirect(redirectUrl || '/stock/alerts?success=purchase');
    }
  });

  // 9. INVENTORY VALUATION (FIFO / WEIGHTED AVERAGE)
  listValuation = asyncHandler(async (req, res) => {
    const valuationReport = await stockValuationService.calculateValuation();

    res.render('stock/valuation', {
      user: req.user,
      valuationItems: valuationReport.valuationItems,
      totalAvgValuation: valuationReport.totalAvgValuation,
      totalFifoValuation: valuationReport.totalFifoValuation,
      categorySummary: valuationReport.categorySummary,
      ALL_ROLES,
      activeSubTab: 'valuation'
    });
  });

  // 10. RF HANDHELD TERMINAL & BARCODE SCANNER
  renderTerminal = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();

    res.render('stock/terminal', {
      user: req.user,
      stockItems,
      ALL_ROLES,
      activeSubTab: 'terminal'
    });
  });
}

module.exports = new StockController();
