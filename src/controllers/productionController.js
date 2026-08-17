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

    const productBOMList = await productionRepository.findAllBOMGroupedByProduct();

    const finishedStockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['name', 'ASC']]
    });

    const componentStockItems = await StockItem.findAll({
      where: { 
        status: 'Active',
        category: { [Op.in]: ['Hammadde', 'Yarı_Mamul', 'Yari_Mamul', 'Ticari_Mal'] }
      },
      order: [['name', 'ASC']]
    });

    const totalProducts = productBOMList.length;
    const withBOM = productBOMList.filter(p => p.hasBOM).length;
    const withoutBOM = totalProducts - withBOM;

    res.render('production/bom', {
      user: req.user,
      productBOMList,
      finishedStockItems,
      componentStockItems,
      WORK_CENTERS,
      stats: { totalProducts, withBOM, withoutBOM },
      ALL_ROLES,
      activeSubTab: 'bom'
    });
  });

  renderBOMForm = asyncHandler(async (req, res) => {
    const { StockItem, BOMItem } = require('../../models');
    const { Op } = require('sequelize');

    const finishedStockItemId = req.params.finishedStockItemId || req.query.productId || null;

    const existingBOMs = await BOMItem.findAll({
      attributes: ['finishedStockItemId'],
      group: ['finishedStockItemId']
    });
    const productsWithBOMSet = new Set(existingBOMs.map(b => b.finishedStockItemId));

    const finishedStockItems = await StockItem.findAll({
      where: { status: 'Active', category: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] } },
      order: [['name', 'ASC']]
    });

    const processedFinishedItems = finishedStockItems.map(item => {
      const itemPlain = item.get({ plain: true });
      itemPlain.hasBOM = productsWithBOMSet.has(item.id);
      return itemPlain;
    });

    const componentStockItems = await StockItem.findAll({
      where: { 
        status: 'Active',
        category: { [Op.in]: ['Hammadde', 'Yarı_Mamul', 'Yari_Mamul', 'Ticari_Mal'] }
      },
      order: [['name', 'ASC']]
    });

    let targetProduct = null;
    let existingBOMItems = [];

    if (finishedStockItemId) {
      targetProduct = await StockItem.findByPk(finishedStockItemId);
      existingBOMItems = await BOMItem.findAll({
        where: { finishedStockItemId },
        include: [
          { model: StockItem, as: 'componentItem' },
          { model: StockItem, as: 'alternativeComponentItem' }
        ],
        order: [['level', 'ASC'], ['id', 'ASC']]
      });
    }

    res.render('production/bom_form', {
      user: req.user,
      targetProduct,
      existingBOMItems,
      finishedStockItems: processedFinishedItems,
      componentStockItems,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'bom'
    });
  });

  saveBOM = asyncHandler(async (req, res) => {
    const {
      finishedStockItemId,
      version,
      baseQuantity,
      componentsJson,
      componentStockItemId,
      quantityRequired,
      unit,
      scrapPercentage,
      operationCode,
      alternativeComponentItemId,
      alternativeNotes,
      notes
    } = req.body;

    if (!finishedStockItemId) {
      throw new ValidationError('Lütfen reçetesi yazılacak ürünü seçiniz.');
    }

    let components = [];

    if (componentsJson) {
      try {
        components = JSON.parse(componentsJson);
      } catch (err) {
        throw new ValidationError('Bileşen verileri geçersiz formatta.');
      }
    } else if (Array.isArray(componentStockItemId)) {
      components = componentStockItemId.map((compItemId, idx) => ({
        componentStockItemId: compItemId,
        quantityRequired: Array.isArray(quantityRequired) ? quantityRequired[idx] : quantityRequired,
        unit: Array.isArray(unit) ? unit[idx] : unit,
        scrapPercentage: Array.isArray(scrapPercentage) ? scrapPercentage[idx] : scrapPercentage,
        operationCode: Array.isArray(operationCode) ? operationCode[idx] : operationCode,
        alternativeComponentItemId: Array.isArray(alternativeComponentItemId) ? alternativeComponentItemId[idx] : alternativeComponentItemId,
        alternativeNotes: Array.isArray(alternativeNotes) ? alternativeNotes[idx] : alternativeNotes,
        notes: Array.isArray(notes) ? notes[idx] : notes
      }));
    } else if (componentStockItemId) {
      components = [{
        componentStockItemId,
        quantityRequired,
        unit,
        scrapPercentage,
        operationCode,
        alternativeComponentItemId,
        alternativeNotes,
        notes
      }];
    }

    await productionRepository.saveProductBOM(
      finishedStockItemId,
      {
        version: version || 'Rev.01',
        baseQuantity: parseFloat(baseQuantity) || 1.0,
        components
      },
      req.user,
      req.ip
    );

    res.redirect('/production/bom');
  });

  deleteBOM = asyncHandler(async (req, res) => {
    const { finishedStockItemId } = req.params;
    if (!finishedStockItemId) {
      throw new ValidationError('Ürün kimliği gereklidir.');
    }

    await productionRepository.deleteProductBOM(finishedStockItemId, req.user, req.ip);
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
