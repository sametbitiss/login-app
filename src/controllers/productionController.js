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

  // 1. REQUISITIONS & WORK ORDERS LIST (Talepler: Üretim ve Reçete Oluşturma Talepleri)
  listRequisitions = asyncHandler(async (req, res) => {
    const { search, status, priority, tab } = req.query;
    const { StockItem, BOMItem, ProductionOrder } = require('../../models');
    const { Op } = require('sequelize');

    // Auto-sync: Ensure active Mamul/Yarı_Mamul stock items with procurementMethod='Üretim' without a BOM have a BOM Requisition
    try {
      const finishedStockItems = await StockItem.findAll({
        where: {
          status: 'Active',
          category: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] },
          procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
        }
      });

      const existingBOMs = await BOMItem.findAll({ attributes: ['finishedStockItemId'], group: ['finishedStockItemId'] });
      const productsWithBOM = new Set(existingBOMs.map(b => b.finishedStockItemId));

      const existingBOMReqs = await ProductionOrder.findAll({
        where: {
          [Op.or]: [
            { workOrderNo: { [Op.like]: 'REQ-BOM-%' } },
            { productionTitle: { [Op.like]: '%Reçete Oluşturma%' } }
          ]
        },
        attributes: ['stockItemId']
      });
      const productsWithReq = new Set(existingBOMReqs.map(r => r.stockItemId));

      const today = new Date().toISOString().split('T')[0];
      for (const item of finishedStockItems) {
        if (!productsWithBOM.has(item.id) && !productsWithReq.has(item.id)) {
          const reqNo = `REQ-BOM-${Date.now().toString().slice(-6)}-${item.id}`;
          await ProductionOrder.create({
            workOrderNo: reqNo,
            productionTitle: `📜 Reçete Oluşturma Talebi — ${item.name}`,
            stockItemId: item.id,
            plannedQuantity: 1,
            unit: item.unit || 'Adet',
            status: 'Planned',
            priority: 'High',
            workCenter: 'İstasyon-1 (Kesim & Büküm)',
            plannedStartDate: today,
            plannedEndDate: today,
            notes: `Stok & Depo Modülündeki [${item.stockCode}] ${item.name} (${item.category === 'Mamul' ? 'Mamul' : 'Yarı Mamul'}) ürünü için otomatik reçete oluşturma talebi açıldı.`,
            createdBy: req.user ? req.user.id : null
          });
        }
      }
    } catch (err) {
      console.error('Error syncing BOM requisitions:', err);
    }

    const allOrders = await productionRepository.findAll({ search, status, priority });
    const stats = await productionRepository.getStats();

    // Split requisitions into Production Requisitions and BOM Requisitions
    const productionRequisitions = allOrders.filter(o => {
      const isBOMReq = (o.workOrderNo && o.workOrderNo.startsWith('REQ-BOM')) || (o.productionTitle && o.productionTitle.includes('Reçete Oluşturma'));
      return !isBOMReq;
    });

    const bomRequisitions = allOrders.filter(o => {
      return (o.workOrderNo && o.workOrderNo.startsWith('REQ-BOM')) || (o.productionTitle && o.productionTitle.includes('Reçete Oluşturma'));
    });

    res.render('production/requisitions', {
      user: req.user,
      orders: allOrders,
      productionRequisitions,
      bomRequisitions,
      stats,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'requisitions',
      activeTab: tab || 'production',
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
    const { stockItemId, plannedQty, requisitionId, requisitionNo } = req.query;
    const { StockItem, ProductionOrder } = require('../../models');
    const { Op } = require('sequelize');

    const stockItems = await StockItem.findAll({
      where: {
        status: 'Active',
        category: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] },
        procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['name', 'ASC']]
    });

    let targetProduct = null;
    let multiLevelPlan = [];
    let sourceRequisition = null;
    let isLockedProduct = false;

    if (requisitionId) {
      sourceRequisition = await ProductionOrder.findByPk(requisitionId);
    }

    const effectiveStockItemId = stockItemId || (sourceRequisition ? sourceRequisition.stockItemId : null);
    if (requisitionId || stockItemId) {
      isLockedProduct = true;
    }

    let minStockLimit = 0;
    let effectiveQty = 100;

    if (effectiveStockItemId) {
      targetProduct = await StockItem.findByPk(effectiveStockItemId);
      if (targetProduct) {
        minStockLimit = parseFloat(targetProduct.minStock || 0);

        if (plannedQty) {
          effectiveQty = Math.max(minStockLimit, parseFloat(plannedQty));
        } else if (sourceRequisition) {
          effectiveQty = Math.max(minStockLimit, parseFloat(sourceRequisition.plannedQuantity || 100));
        } else {
          effectiveQty = minStockLimit > 0 ? minStockLimit : 100;
        }

        multiLevelPlan = await productionRepository.getMultiLevelProductionPlan(effectiveStockItemId, effectiveQty);
      }
    }

    const effectiveOrderSource = requisitionNo || (sourceRequisition ? sourceRequisition.workOrderNo : `SOP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
    const nextWorkOrderNo = await productionRepository.generateWorkOrderNo();

    res.render('production/add', {
      user: req.user,
      stockItems,
      targetProduct,
      multiLevelPlan,
      sourceRequisition,
      effectiveQty,
      minStockLimit,
      isLockedProduct,
      effectiveOrderSource,
      nextWorkOrderNo,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'add_order',
      error: null
    });
  });

  addOrder = asyncHandler(async (req, res) => {
    const {
      ordersJson,
      requisitionId,
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

    const { ProductionOrder } = require('../../models');

    // Batch work orders creation from multi-level plan
    if (ordersJson) {
      let ordersArray = [];
      try {
        ordersArray = JSON.parse(ordersJson);
      } catch (err) {
        throw new ValidationError('İş emri verileri geçersiz formatta.');
      }

      for (let i = 0; i < ordersArray.length; i++) {
        const item = ordersArray[i];
        const woNo = await productionRepository.generateWorkOrderNo();

        await productionRepository.create({
          workOrderNo: woNo,
          productionTitle: item.productionTitle || `[Seviye ${item.level}] İmalat İş Emri — ${item.productName}`,
          stockItemId: item.stockItemId,
          plannedQuantity: parseFloat(item.plannedQuantity) || 1,
          unit: item.unit || 'Adet',
          status: item.status || 'Planned',
          priority: item.priority || 'Normal',
          workCenter: item.workCenter || WORK_CENTERS[0],
          plannedStartDate: item.plannedStartDate,
          plannedEndDate: item.plannedEndDate,
          notes: item.notes || `Sipariş Kaynağı: ${item.orderSource || 'Manuel'}`
        }, req.user, req.ip);
      }

      // If created from a requisition, update the requisition status to Completed
      if (requisitionId) {
        const reqOrder = await ProductionOrder.findByPk(requisitionId);
        if (reqOrder) {
          reqOrder.status = 'Completed';
          await reqOrder.save();
        }
      }

      return res.redirect('/production/orders');
    }

    // Single work order creation fallback
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
      productionManager,
      bomNotes,
      notes
    }, req.user, req.ip);

    if (requisitionId) {
      const reqOrder = await ProductionOrder.findByPk(requisitionId);
      if (reqOrder) {
        reqOrder.status = 'Completed';
        await reqOrder.save();
      }
    }

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
      where: {
        status: 'Active',
        category: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] },
        procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['name', 'ASC']]
    });

    const componentStockItems = await StockItem.findAll({
      where: { 
        status: 'Active',
        [Op.or]: [
          { category: { [Op.in]: ['Hammadde', 'Ticari_Mal'] } },
          {
            category: { [Op.in]: ['Yarı_Mamul', 'Yari_Mamul'] },
            procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
          }
        ]
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
      where: {
        status: 'Active',
        category: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] },
        procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
      },
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
        [Op.or]: [
          { category: { [Op.in]: ['Hammadde', 'Ticari_Mal'] } },
          {
            category: { [Op.in]: ['Yarı_Mamul', 'Yari_Mamul'] },
            procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
          }
        ]
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
    const productRoutingList = await productionRepository.findAllRoutingsGroupedByProduct();

    const totalCandidateProducts = productRoutingList.length;
    const withRouting = productRoutingList.filter(p => p.hasRouting).length;
    const withoutRouting = totalCandidateProducts - withRouting;

    res.render('production/routing', {
      user: req.user,
      productRoutingList,
      stats: { totalCandidateProducts, withRouting, withoutRouting },
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'routing'
    });
  });

  renderRoutingForm = asyncHandler(async (req, res) => {
    const { StockItem, BOMItem, RoutingOperation } = require('../../models');
    const { Op } = require('sequelize');

    const stockItemId = req.params.stockItemId || req.query.productId || null;

    // 1. Get all products with a BOM (candidate products for routing)
    const existingBOMs = await BOMItem.findAll({
      attributes: ['finishedStockItemId'],
      group: ['finishedStockItemId']
    });
    const finishedItemIds = existingBOMs.map(b => b.finishedStockItemId);

    const bomProducts = await StockItem.findAll({
      where: {
        id: { [Op.in]: finishedItemIds },
        status: 'Active',
        category: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] },
        procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['name', 'ASC']]
    });

    // 2. Identify products that already have a routing
    const existingRoutings = await RoutingOperation.findAll({
      attributes: ['stockItemId'],
      group: ['stockItemId']
    });
    const productsWithRoutingSet = new Set(existingRoutings.map(r => r.stockItemId));

    const processedBOMProducts = bomProducts.map(p => {
      const plain = p.get({ plain: true });
      plain.hasRouting = productsWithRoutingSet.has(p.id);
      return plain;
    });

    // 3. Fetch all BOM items for candidate products to build client-side BOM reference map
    const allBOMItems = await BOMItem.findAll({
      where: { finishedStockItemId: { [Op.in]: finishedItemIds } },
      include: [{ model: StockItem, as: 'componentItem' }],
      order: [['level', 'ASC'], ['id', 'ASC']]
    });

    const bomComponentsMap = {};
    allBOMItems.forEach(b => {
      if (!bomComponentsMap[b.finishedStockItemId]) {
        bomComponentsMap[b.finishedStockItemId] = [];
      }
      bomComponentsMap[b.finishedStockItemId].push({
        code: b.componentItem ? b.componentItem.stockCode : '',
        name: b.componentItem ? b.componentItem.name : '',
        category: b.componentItem ? b.componentItem.category : '',
        qty: b.quantityRequired,
        unit: b.unit,
        level: b.level
      });
    });

    let targetProduct = null;
    let existingOperations = [];
    let targetBOMComponents = [];

    if (stockItemId) {
      targetProduct = await StockItem.findByPk(stockItemId);
      if (targetProduct) {
        existingOperations = await RoutingOperation.findAll({
          where: { stockItemId },
          order: [['operationSeq', 'ASC'], ['id', 'ASC']]
        });
        targetBOMComponents = bomComponentsMap[stockItemId] || [];
      }
    }

    res.render('production/routing_form', {
      user: req.user,
      targetProduct,
      existingOperations,
      targetBOMComponents,
      candidateProducts: processedBOMProducts,
      bomComponentsMap,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'routing'
    });
  });

  saveRouting = asyncHandler(async (req, res) => {
    const { stockItemId, operationsJson } = req.body;

    if (!stockItemId) {
      throw new ValidationError('Lütfen rotası oluşturulacak ürünü seçiniz.');
    }

    let operations = [];
    if (operationsJson) {
      try {
        operations = JSON.parse(operationsJson);
      } catch (err) {
        throw new ValidationError('Operasyon verileri geçersiz formatta.');
      }
    }

    await productionRepository.saveProductRouting(stockItemId, operations, req.user, req.ip);
    res.redirect('/production/routing');
  });

  deleteRouting = asyncHandler(async (req, res) => {
    const { stockItemId } = req.params;
    if (!stockItemId) {
      throw new ValidationError('Ürün kimliği gereklidir.');
    }

    await productionRepository.deleteProductRouting(stockItemId, req.user, req.ip);
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
