const stockRepository = require('../repositories/stockRepository');
const stockValuationService = require('../services/stockValuationService');
const purchaseRepository = require('../repositories/purchaseRepository');
const salesRepository = require('../repositories/saleRepository');
const requisitionRepository = require('../repositories/requisitionRepository');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');

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

    res.render('stock/list', {
      user: req.user,
      stockItems,
      stats,
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'items',
      filterSearch: search || '',
      filterCategory: category || '',
      filterStatus: status || ''
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
    const purchaseOrders = await purchaseRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/goods_receipt', {
      user: req.user,
      purchaseOrders,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'goods-receipt'
    });
  });

  confirmGoodsReceipt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await purchaseRepository.updateStatus(id, 'Received', req.user, req.ip);
    res.redirect('/stock/goods-receipt');
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

    res.render('stock/alerts', {
      user: req.user,
      lowStockItems,
      requisitions,
      ALL_ROLES,
      activeSubTab: 'alerts',
      successMsg: req.query.success === 'true' ? 'Satın Alma Talebi başarıyla oluşturuldu ve Satın Alma Departmanına iletildi.' : null
    });
  });

  createStockRequisition = asyncHandler(async (req, res) => {
    const { stockItemId, requestedQuantity, urgency, notes } = req.body;

    if (!stockItemId || !requestedQuantity) {
      throw new ValidationError('Malzeme ve talep miktarı seçimi zorunludur.');
    }

    await requisitionRepository.create({
      sourceModule: 'Stock',
      stockItemId,
      requestedQuantity: parseFloat(requestedQuantity) || 1,
      urgency: urgency || 'Normal',
      status: 'Pending',
      requesterName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.username,
      notes: notes || 'Kritik stok seviyesi altına düşüldüğü için depodan otomatik talep oluşturuldu.'
    }, req.user, req.ip);

    res.redirect('/stock/alerts?success=true');
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
