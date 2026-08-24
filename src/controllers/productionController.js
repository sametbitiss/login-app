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
    const mrpData = await mrpService.runMRP();

    res.render('production/analytics', {
      user: req.user,
      orders,
      stats,
      capacityReport,
      mrpResults: (mrpData.mrpResults || []).slice(0, 5),
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'analytics'
    });
  });

  // 1. REQUISITIONS & WORK ORDERS LIST
  listRequisitions = asyncHandler(async (req, res) => {
    const { search, status, priority } = req.query;

    const allOrders = await productionRepository.findAll({ search, status, priority });
    const stats = await productionRepository.getStats();

    // Sadece gerçek üretim taleplerini al
    const productionRequisitions = allOrders.filter(o => {
      const isBOMReq = (o.isEmriNo && o.isEmriNo.startsWith('REQ-BOM')) || (o.uretimBasligi && o.uretimBasligi.includes('Reçete Oluşturma'));
      return !isBOMReq;
    });

    res.render('production/requisitions', {
      user: req.user,
      orders: productionRequisitions,
      productionRequisitions,
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
    const { stockItemId, plannedQty, requisitionId, requisitionNo } = req.query;
    const { StokKarti, UretimEmri } = require('../../models');
    const { Op } = require('sequelize');

    const stockItems = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] },
        tedarikYontemi: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['ad', 'ASC']]
    });

    let targetProduct = null;
    let multiLevelPlan = [];
    let sourceRequisition = null;
    let isLockedProduct = false;

    if (requisitionId) {
      sourceRequisition = await UretimEmri.findByPk(requisitionId);
    }

    const effectiveStockItemId = stockItemId || (sourceRequisition ? sourceRequisition.stokId : null);
    if (requisitionId || stockItemId) {
      isLockedProduct = true;
    }

    let minStockLimit = 0;
    let effectiveQty = 100;

    if (effectiveStockItemId) {
      targetProduct = await StokKarti.findByPk(effectiveStockItemId);
      if (targetProduct) {
        minStockLimit = parseFloat(targetProduct.asgariStok || 0);
        const reqQty = sourceRequisition ? parseFloat(sourceRequisition.planlananMiktar || 0) : 0;
        const qtyFloor = Math.max(minStockLimit, reqQty, 1);

        if (plannedQty) {
          effectiveQty = Math.max(qtyFloor, parseFloat(plannedQty) || 1);
        } else if (sourceRequisition) {
          effectiveQty = qtyFloor;
        } else {
          effectiveQty = qtyFloor > 1 ? qtyFloor : 100;
        }

        multiLevelPlan = await productionRepository.getMultiLevelProductionPlan(effectiveStockItemId, effectiveQty);
      }
    }

    const effectiveOrderSource = requisitionNo || (sourceRequisition ? sourceRequisition.isEmriNo : `SOP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`);
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

    const { UretimEmri, StokKarti } = require('../../models');

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

        const sId = item.stokId || item.stockItemId;
        const itemProduct = await StokKarti.findByPk(sId);
        const itemMinStock = itemProduct ? parseFloat(itemProduct.asgariStok || 0) : 0;
        const pQty = parseFloat(item.planlananMiktar || item.plannedQuantity) || 1;
        const validQty = Math.max(pQty, itemMinStock, 1);

        await productionRepository.create({
          isEmriNo: woNo,
          uretimBasligi: item.uretimBasligi || item.productionTitle || `[Seviye ${item.level}] İmalat İş Emri — ${item.productName}`,
          stokId: sId,
          planlananMiktar: validQty,
          birim: item.birim || 'Adet',
          durum: item.durum || item.status || 'Planned',
          oncelik: item.oncelik || item.priority || 'Normal',
          isMerkezi: item.isMerkezi || item.workCenter || WORK_CENTERS[0],
          planlananBaslangicTarihi: item.planlananBaslangicTarihi || item.plannedStartDate,
          planlananBitisTarihi: item.planlananBitisTarihi || item.plannedEndDate,
          notlar: item.notlar || item.notes || `Sipariş Kaynağı: ${item.orderSource || 'Manuel'}`
        }, req.user, req.ip);
      }

      if (requisitionId) {
        const reqOrder = await UretimEmri.findByPk(requisitionId);
        if (reqOrder) {
          reqOrder.durum = 'Completed';
          await reqOrder.save();
        }
      }

      return res.redirect('/production/orders');
    }

    await productionRepository.create({
      uretimBasligi: productionTitle,
      stokId: stockItemId,
      planlananMiktar: parseFloat(plannedQuantity) || 1,
      birim: unit || 'Adet',
      durum: status || 'Planned',
      oncelik: priority || 'Normal',
      isMerkezi: workCenter || WORK_CENTERS[0],
      planlananBaslangicTarihi: plannedStartDate,
      planlananBitisTarihi: plannedEndDate,
      tahminiSaat: parseFloat(estimatedHours) || 0,
      uretimYonetici: productionManager,
      receteNotlari: bomNotes,
      notlar: notes
    }, req.user, req.ip);

    if (requisitionId) {
      const reqOrder = await UretimEmri.findByPk(requisitionId);
      if (reqOrder) {
        reqOrder.durum = 'Completed';
        await reqOrder.save();
      }
    }

    res.redirect('/production/orders');
  });

  updateOrderStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status, durum } = req.body;

    const updated = await productionRepository.updateStatus(id, durum || status, req.user, req.ip);
    if (!updated) {
      throw new NotFoundError('Üretim iş emri bulunamadı.');
    }

    res.redirect('/production/orders');
  });

  // 2. MATERIAL REQUIREMENTS PLANNING (MRP)
  showMRP = asyncHandler(async (req, res) => {
    const mrpData = await mrpService.runMRP();
    let successMsg = null;
    if (req.query.success === 'purchase_created') {
      successMsg = '🛒 Satın Alma Talepleri başarıyla oluşturuldu ve Satın Alma modülüne iletildi.';
    } else if (req.query.success === 'work_order_created') {
      successMsg = '📋 Seçilen iş emirleri başarıyla oluşturuldu ve İmalat planına eklendi.';
    } else if (req.query.success === 'all_created' || req.query.success === '1') {
      successMsg = '⚡ Tüm MRP önerileri (Satın Alma Talepleri ve İş Emirleri) başarıyla sisteme işlendi.';
    }

    res.render('production/mrp', {
      user: req.user,
      mrpData,
      mrpResults: mrpData.mrpResults,
      workOrderSuggestions: mrpData.workOrderSuggestions,
      productionRequisitionSuggestions: mrpData.productionRequisitionSuggestions,
      purchaseRequisitionSuggestions: mrpData.purchaseRequisitionSuggestions,
      orderAnalysisTrees: mrpData.orderAnalysisTrees,
      kpiSummary: mrpData.kpiSummary,
      demandsAnalyzed: mrpData.demandsAnalyzed,
      successMsg,
      errorMsg: req.query.error || null,
      ALL_ROLES,
      activeSubTab: 'mrp'
    });
  });

  executeMRP = asyncHandler(async (req, res) => {
    const { actionType, stockId } = req.body;
    let selectedStockIds = null;
    if (stockId) {
      selectedStockIds = [parseInt(stockId, 10)];
    }

    let createPurchaseReqs = true;
    let createWorkOrders = false;
    let successParam = '1';

    if (actionType === 'create_work_orders') {
      createPurchaseReqs = false;
      createWorkOrders = true;
      successParam = 'work_order_created';
    } else if (actionType === 'create_all') {
      createPurchaseReqs = true;
      createWorkOrders = true;
      successParam = 'all_created';
    } else {
      createPurchaseReqs = true;
      createWorkOrders = false;
      successParam = 'purchase_created';
    }

    await mrpService.executeMRPRecommendations({
      createPurchaseReqs,
      createWorkOrders,
      selectedStockIds
    }, req.user, req.ip);

    res.redirect(`/production/mrp?success=${successParam}`);
  });

  apiGetMRP = asyncHandler(async (req, res) => {
    const data = await mrpService.runMRP();
    res.json({ success: true, data });
  });

  // 3. BOM (BILL OF MATERIALS)
  listBOM = asyncHandler(async (req, res) => {
    const productBOMList = await productionRepository.findAllBOMGroupedByProduct();

    const withBOMList = productBOMList.filter(p => p.hasBOM);
    const withoutBOMList = productBOMList.filter(p => !p.hasBOM);

    const totalProducts = productBOMList.length;
    const withBOM = withBOMList.length;
    const withoutBOM = withoutBOMList.length;

    res.render('production/bom', {
      user: req.user,
      productBOMList,
      withBOMList,
      withoutBOMList,
      stats: { totalProducts, withBOM, withoutBOM },
      activeSubTab: 'bom'
    });
  });

  renderBOMForm = asyncHandler(async (req, res) => {
    const { StokKarti, UrunRecetesi, RotaOperasyon } = require('../../models');
    const { Op } = require('sequelize');

    const finishedStockItemId = req.params.finishedStockItemId || req.query.productId || null;

    const existingRoutings = await RotaOperasyon.findAll({ attributes: ['stokId'], group: ['stokId'] });
    const productsWithRoutingSet = new Set(existingRoutings.map(r => r.stokId));

    const existingBOMs = await UrunRecetesi.findAll({
      attributes: ['mamulStokId'],
      group: ['mamulStokId']
    });
    const productsWithBOMSet = new Set(existingBOMs.map(b => b.mamulStokId));

    const candidateProducts = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] }
      },
      order: [['kategori', 'ASC'], ['ad', 'ASC']]
    });

    const processedCandidates = candidateProducts.map(p => {
      const plain = p.get({ plain: true });
      plain.hasRouting = productsWithRoutingSet.has(p.id);
      plain.hasBOM = productsWithBOMSet.has(p.id);
      return plain;
    });

    let targetProduct = null;
    let existingBOMItems = [];
    let isEditMode = false;
    let currentRecipeNo = '';
    let currentVersion = '1';
    let targetRoutingOperations = [];

    const nextGeneratedRecipeNo = await productionRepository.generateRecipeNo();

    if (finishedStockItemId) {
      targetProduct = await StokKarti.findByPk(finishedStockItemId);
      if (targetProduct) {
        if (targetProduct.kategori === 'Hammadde') {
          throw new ValidationError('Hammadde kategorisindeki ürünler için üretim reçetesi oluşturulamaz.');
        }

        targetRoutingOperations = await RotaOperasyon.findAll({
          where: { stokId: finishedStockItemId },
          order: [['operasyonSira', 'ASC']]
        });

        existingBOMItems = await UrunRecetesi.findAll({
          where: { mamulStokId: finishedStockItemId },
          include: [
            { model: StokKarti, as: 'bilesenUrun' }
          ],
          order: [['id', 'ASC']]
        });

        if (existingBOMItems && existingBOMItems.length > 0) {
          isEditMode = true;
          const oldVer = existingBOMItems[0].versiyon || '1';
          const oldVerNum = parseInt(String(oldVer).replace(/[^0-9]/g, ''), 10) || 1;
          currentVersion = String(oldVerNum + 1);
          currentRecipeNo = existingBOMItems[0].receteKodu || nextGeneratedRecipeNo;
        } else {
          currentRecipeNo = nextGeneratedRecipeNo;
          currentVersion = '1';
        }
      }
    } else {
      currentRecipeNo = nextGeneratedRecipeNo;
      currentVersion = '1';
    }

    // Components catalog for modal: Exclude target product itself!
    const allComponentStockItems = await StokKarti.findAll({
      where: {
        durum: 'Active',
        id: { [Op.ne]: targetProduct ? targetProduct.id : 0 }
      },
      order: [['kategori', 'ASC'], ['ad', 'ASC']]
    });

    res.render('production/bom_form', {
      user: req.user,
      targetProduct,
      existingBOMItems,
      isEditMode,
      currentRecipeNo,
      currentVersion,
      targetRoutingOperations,
      allComponentStockItems,
      candidateProducts: processedCandidates,
      activeSubTab: 'bom'
    });
  });

  saveBOM = asyncHandler(async (req, res) => {
    const {
      finishedStockItemId,
      receteKodu,
      version,
      versiyon,
      baseQuantity,
      bazMiktar,
      gecerlilikBaslangic,
      gecerlilikBitis,
      durum,
      notlar,
      notes,
      componentsJson
    } = req.body;

    const targetMamulId = finishedStockItemId || req.body.mamulStokId;
    if (!targetMamulId) {
      throw new ValidationError('Lütfen reçetesi yazılacak ürünü seçiniz.');
    }

    const { RotaOperasyon } = require('../../models');

    // Rule: "Rota olmadan reçete olamaz"
    const hasRouting = await RotaOperasyon.findOne({ where: { stokId: targetMamulId } });
    if (!hasRouting) {
      throw new ValidationError('Bir ürünün reçetesi (BOM) oluşturulabilmesi için önce üretim rotasının ve operasyon adımlarının tanımlanmış olması gerekmektedir.');
    }

    let components = [];
    if (componentsJson) {
      try {
        components = JSON.parse(componentsJson);
      } catch (err) {
        throw new ValidationError('Bileşen verileri geçersiz formatta.');
      }
    }

    await productionRepository.saveProductBOM(
      targetMamulId,
      {
        receteKodu,
        version,
        baseQuantity: parseFloat(baseQuantity || bazMiktar) || 1.0,
        gecerlilikBaslangic,
        gecerlilikBitis,
        durum: durum || 'Active',
        notlar: notlar || notes || null,
        components
      },
      req.user,
      req.ip
    );

    res.redirect('/production/bom');
  });

  deleteBOM = asyncHandler(async (req, res) => {
    const finishedStockItemId = req.params.finishedStockItemId || req.params.mamulStokId;
    if (!finishedStockItemId) {
      throw new ValidationError('Ürün kimliği gereklidir.');
    }

    await productionRepository.deleteProductBOM(finishedStockItemId, req.user, req.ip);
    res.redirect('/production/bom');
  });

  // 4. ROUTING & OPERATIONS
  listRouting = asyncHandler(async (req, res) => {
    const { IsMerkezi } = require('../../models');
    const productRoutingList = await productionRepository.findAllRoutingsGroupedByProduct();

    const withRoutingList = productRoutingList.filter(p => p.hasRouting);
    const withoutRoutingList = productRoutingList.filter(p => !p.hasRouting);

    const totalCandidateProducts = productRoutingList.length;
    const withRouting = withRoutingList.length;
    const withoutRouting = withoutRoutingList.length;

    const workCenters = await IsMerkezi.findAll({
      where: { durum: 'Active' },
      order: [['isMerkeziKodu', 'ASC']]
    });

    res.render('production/routing', {
      user: req.user,
      productRoutingList,
      withRoutingList,
      withoutRoutingList,
      stats: { totalCandidateProducts, withRouting, withoutRouting },
      workCenters,
      activeSubTab: 'routing'
    });
  });

  renderRoutingForm = asyncHandler(async (req, res) => {
    const { StokKarti, UrunRecetesi, RotaOperasyon, IsMerkezi } = require('../../models');
    const { Op } = require('sequelize');

    const stockItemId = req.params.stockItemId || req.query.productId || req.params.stokId || null;

    const candidateProducts = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] }
      },
      order: [['kategori', 'ASC'], ['ad', 'ASC']]
    });

    const existingRoutings = await RotaOperasyon.findAll({
      attributes: ['stokId'],
      group: ['stokId']
    });
    const productsWithRoutingSet = new Set(existingRoutings.map(r => r.stokId));

    const candidateProductIds = candidateProducts.map(p => p.id);
    const processedCandidateProducts = candidateProducts.map(p => {
      const plain = p.get({ plain: true });
      plain.hasRouting = productsWithRoutingSet.has(p.id);
      return plain;
    });

    const allBOMItems = await UrunRecetesi.findAll({
      where: { mamulStokId: { [Op.in]: candidateProductIds } },
      include: [{ model: StokKarti, as: 'bilesenUrun' }],
      order: [['seviye', 'ASC'], ['id', 'ASC']]
    });

    const bomComponentsMap = {};
    allBOMItems.forEach(b => {
      if (!bomComponentsMap[b.mamulStokId]) {
        bomComponentsMap[b.mamulStokId] = [];
      }
      bomComponentsMap[b.mamulStokId].push({
        code: b.bilesenUrun ? b.bilesenUrun.stokKodu : '',
        name: b.bilesenUrun ? b.bilesenUrun.ad : '',
        category: b.bilesenUrun ? b.bilesenUrun.kategori : '',
        qty: b.gerekliMiktar,
        unit: b.birim,
        level: b.seviye
      });
    });

    // Work Centers catalog from DB
    const allWorkCenters = await IsMerkezi.findAll({
      where: { durum: 'Active' },
      order: [['isMerkeziKodu', 'ASC']]
    });

    let targetProduct = null;
    let existingOperations = [];
    let targetBOMComponents = [];

    if (stockItemId) {
      targetProduct = await StokKarti.findByPk(stockItemId);
      if (targetProduct) {
        existingOperations = await RotaOperasyon.findAll({
          where: { stokId: stockItemId },
          order: [['operasyonSira', 'ASC'], ['id', 'ASC']]
        });
        targetBOMComponents = bomComponentsMap[stockItemId] || [];
      }
    }

    res.render('production/routing_form', {
      user: req.user,
      targetProduct,
      existingOperations,
      targetBOMComponents,
      candidateProducts: processedCandidateProducts,
      bomComponentsMap,
      allWorkCenters,
      activeSubTab: 'routing'
    });
  });

  saveRouting = asyncHandler(async (req, res) => {
    const stockItemId = req.body.stockItemId || req.body.stokId;
    const { operationsJson } = req.body;

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
    const stockItemId = req.params.stockItemId || req.params.stokId;
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
    const { completedQuantity, scrapQuantity, tamamlananMiktar, fireMiktari } = req.body;

    await productionService.recordProductionOutput(
      id,
      parseFloat(tamamlananMiktar !== undefined ? tamamlananMiktar : completedQuantity) || 0,
      parseFloat(fireMiktari !== undefined ? fireMiktari : scrapQuantity) || 0,
      req.user
    );

    res.redirect('/production/mes');
  });
}

module.exports = new ProductionController();
