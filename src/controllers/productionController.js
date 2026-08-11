const productionRepository = require('../repositories/productionRepository');
const stockRepository = require('../repositories/stockRepository');
const mrpService = require('../services/mrpService');
const productionService = require('../services/productionService');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');

const WORK_CENTERS = [
  'İstasyon-1 (Kesim & Büküm)',
  'İstasyon-2 (Kaynak & Sac İşleme)',
  'İstasyon-3 (CNC & Talaşlı İmalat)',
  'İstasyon-4 (Boya & Kaplama)',
  'İstasyon-5 (Montaj & Test)',
  'İstasyon-6 (Paketleme & Sevkiyat)'
];

class ProductionController {
  // 0. DASHBOARD & ANALYTICS
  showAnalytics = asyncHandler(async (req, res) => {
    const orders = await productionRepository.findAll();
    const stats = await productionRepository.getStats();
    const capacityReport = await mrpService.calculateCapacityLoad();
    const mrpResults = await mrpService.runMRP();

    res.render('production/analytics', {
      user: req.user,
      orders,
      stats,
      capacityReport,
      mrpResults: mrpResults.slice(0, 5),
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'analytics'
    });
  });

  // 1. REQUISITIONS & WORK ORDERS LIST
  listRequisitions = asyncHandler(async (req, res) => {
    const { search, status, priority } = req.query;
    const orders = await productionRepository.findAll({ search, status, priority });
    const stats = await productionRepository.getStats();

    res.render('production/requisitions', {
      user: req.user,
      orders,
      stats,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'requisitions',
      filterSearch: search || '',
      filterStatus: status || '',
      filterPriority: priority || ''
    });
  });

  listOrders = asyncHandler(async (req, res) => {
    const { search, status, priority, workCenter } = req.query;
    const orders = await productionRepository.findAll({ search, status, priority, workCenter });
    const stats = await productionRepository.getStats();

    res.render('production/list', {
      user: req.user,
      orders,
      stats,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'orders',
      filterSearch: search || '',
      filterStatus: status || '',
      filterPriority: priority || '',
      filterWorkCenter: workCenter || ''
    });
  });

  renderAddOrder = asyncHandler(async (req, res) => {
    const { StockItem } = require('../../models');
    const { Op } = require('sequelize');
    const stockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal', 'Yari_Mamul', 'Yarı_Mamul'] } },
      order: [['name', 'ASC']]
    });
    const nextWorkOrderNo = await productionRepository.generateWorkOrderNo();

    res.render('production/add', {
      user: req.user,
      stockItems,
      nextWorkOrderNo,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'add_order',
      error: null
    });
  });

  addOrder = asyncHandler(async (req, res) => {
    const {
      productionTitle,
      stockItemId,
      plannedQuantity,
      unit,
      status,
      priority,
      workCenter,
      plannedStartDate,
      plannedEndDate,
      estimatedHours,
      productionManager,
      bomNotes,
      notes
    } = req.body;

    await productionRepository.create({
      productionTitle,
      stockItemId,
      plannedQuantity: parseFloat(plannedQuantity) || 1,
      unit: unit || 'Adet',
      status: status || 'Planned',
      priority: priority || 'Normal',
      workCenter: workCenter || WORK_CENTERS[0],
      plannedStartDate,
      plannedEndDate,
      estimatedHours: parseFloat(estimatedHours) || 0,
      productionManager: productionManager ? productionManager.trim() : req.user.username,
      bomNotes,
      notes,
      createdBy: req.user.id
    }, req.user, req.ip);

    res.redirect('/production/orders');
  });

  updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const updated = await productionRepository.updateStatus(id, status, req.user, req.ip);
    if (!updated) {
      throw new NotFoundError('Üretim iş emri bulunamadı.');
    }

    res.redirect('/production/orders');
  });

  // 2. MATERIAL REQUIREMENTS PLANNING (MRP)
  showMRP = asyncHandler(async (req, res) => {
    const mrpResults = await mrpService.runMRP();
    const successMsg = req.query.success === '1' ? 'Otomatik Satın Alma Talepleri başarıyla oluşturuldu ve Satın Alma departmanına iletildi.' : null;

    res.render('production/mrp', {
      user: req.user,
      mrpResults,
      successMsg,
      ALL_ROLES,
      activeSubTab: 'mrp'
    });
  });

  executeMRP = asyncHandler(async (req, res) => {
    const mrpResults = await mrpService.runMRP();
    await mrpService.generateRequisitions(mrpResults, req.user);
    res.redirect('/production/mrp?success=1');
  });

  // 3. BOM (BILL OF MATERIALS)
  listBOM = asyncHandler(async (req, res) => {
    const { StockItem } = require('../../models');
    const { Op } = require('sequelize');
    const bomItems = await productionRepository.findAllBOM();

    const finishedStockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Ticari_Mal', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['name', 'ASC']]
    });

    const componentStockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Hammadde', 'Yari_Mamul', 'Yarı_Mamul', 'Mamul', 'Ticari_Mal', 'Diger'] } },
      order: [['name', 'ASC']]
    });

    res.render('production/bom', {
      user: req.user,
      bomItems,
      finishedStockItems,
      componentStockItems,
      ALL_ROLES,
      activeSubTab: 'bom'
    });
  });

  addBOM = asyncHandler(async (req, res) => {
    const { finishedStockItemId, componentStockItemId, quantityRequired, scrapPercentage, notes } = req.body;

    if (!finishedStockItemId || !componentStockItemId) {
      throw new ValidationError('Üretilecek ürün ve hammadde seçimi zorunludur.');
    }

    const bomCode = `BOM-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await productionRepository.createBOMItem({
      bomCode,
      finishedStockItemId,
      componentStockItemId,
      quantityRequired: parseFloat(quantityRequired) || 1,
      scrapPercentage: parseFloat(scrapPercentage) || 0,
      notes
    }, req.user, req.ip);

    res.redirect('/production/bom');
  });

  // 4. ROUTING & OPERATIONS
  listRouting = asyncHandler(async (req, res) => {
    const routings = await productionRepository.findAllRoutings();
    const stockItems = await stockRepository.findAll();

    res.render('production/routing', {
      user: req.user,
      routings,
      stockItems,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'routing'
    });
  });

  addRouting = asyncHandler(async (req, res) => {
    const { stockItemId, operationSeq, operationName, workCenter, setupTimeMinutes, runTimeMinutesPerUnit, instructions } = req.body;

    if (!stockItemId || !operationName || !workCenter) {
      throw new ValidationError('Ürün, operasyon adı ve iş merkezi zorunludur.');
    }

    const routingCode = `ROTA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await productionRepository.createRoutingOperation({
      routingCode,
      stockItemId,
      operationSeq: parseInt(operationSeq, 10) || 10,
      operationName,
      workCenter,
      setupTimeMinutes: parseFloat(setupTimeMinutes) || 15,
      runTimeMinutesPerUnit: parseFloat(runTimeMinutesPerUnit) || 5,
      instructions
    }, req.user, req.ip);

    res.redirect('/production/routing');
  });

  // 5. CAPACITY PLANNING
  listCapacity = asyncHandler(async (req, res) => {
    const capacityReport = await mrpService.calculateCapacityLoad();

    res.render('production/capacity', {
      user: req.user,
      capacityReport,
      ALL_ROLES,
      activeSubTab: 'capacity'
    });
  });

  // 6. MES & PRODUCTION TRACKING
  listMES = asyncHandler(async (req, res) => {
    const orders = await productionRepository.findAll();

    res.render('production/mes', {
      user: req.user,
      orders,
      ALL_ROLES,
      activeSubTab: 'mes'
    });
  });

  updateMES = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { completedQuantity, scrapQuantity } = req.body;

    await productionService.recordProductionOutput(
      id,
      parseFloat(completedQuantity) || 0,
      parseFloat(scrapQuantity) || 0,
      req.user
    );

    res.redirect('/production/mes');
  });
}

module.exports = new ProductionController();
