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
    const { StokKarti } = require('../../models');
    const { Op } = require('sequelize');

    const productBOMList = await productionRepository.findAllBOMGroupedByProduct();

    const finishedStockItems = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] }
      },
      order: [['ad', 'ASC']]
    });

    const componentStockItems = await StokKarti.findAll({
      where: { 
        durum: 'Active',
        kategori: { [Op.in]: ['Hammadde', 'Yarı_Mamul', 'Yari_Mamul', 'Ticari_Mal'] }
      },
      order: [['ad', 'ASC']]
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
    const { StokKarti, UrunRecetesi } = require('../../models');
    const { Op } = require('sequelize');

    const finishedStockItemId = req.params.finishedStockItemId || req.query.productId || null;

    const existingBOMs = await UrunRecetesi.findAll({
      attributes: ['mamulStokId'],
      group: ['mamulStokId']
    });
    const productsWithBOMSet = new Set(existingBOMs.map(b => b.mamulStokId));

    const finishedStockItems = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] }
      },
      order: [['ad', 'ASC']]
    });

    const processedFinishedItems = finishedStockItems.map(item => {
      const itemPlain = item.get({ plain: true });
      itemPlain.hasBOM = productsWithBOMSet.has(item.id);
      return itemPlain;
    });

    const componentStockItems = await StokKarti.findAll({
      where: { 
        durum: 'Active',
        kategori: { [Op.in]: ['Hammadde', 'Yarı_Mamul', 'Yari_Mamul', 'Ticari_Mal'] }
      },
      order: [['ad', 'ASC']]
    });

    let targetProduct = null;
    let existingBOMItems = [];
    let isEditMode = false;
    let currentRecipeNo = '';
    let currentVersion = '1';
    let previousVersion = null;

    const nextGeneratedRecipeNo = await productionRepository.generateRecipeNo();

    if (finishedStockItemId) {
      targetProduct = await StokKarti.findByPk(finishedStockItemId);
      existingBOMItems = await UrunRecetesi.findAll({
        where: { mamulStokId: finishedStockItemId },
        include: [
          { model: StokKarti, as: 'bilesenUrun' },
          { model: StokKarti, as: 'alternatifBilesenUrun' }
        ],
        order: [['seviye', 'ASC'], ['id', 'ASC']]
      });

      if (existingBOMItems && existingBOMItems.length > 0) {
        isEditMode = true;
        const oldVer = existingBOMItems[0].versiyon || '1';
        previousVersion = oldVer;
        const oldVerNum = parseInt(String(oldVer).replace(/[^0-9]/g, ''), 10) || 1;
        currentVersion = String(oldVerNum + 1);
        currentRecipeNo = nextGeneratedRecipeNo;
      } else {
        currentRecipeNo = nextGeneratedRecipeNo;
        currentVersion = '1';
      }
    } else {
      currentRecipeNo = nextGeneratedRecipeNo;
      currentVersion = '1';
    }

    const { RotaOperasyon } = require('../../models');
    const routingOperations = await RotaOperasyon.findAll({ order: [['operasyonSira', 'ASC']] });

    const unassignedFinishedItems = processedFinishedItems.filter(item => !item.hasBOM);

    res.render('production/bom_form', {
      user: req.user,
      targetProduct,
      existingBOMItems,
      isEditMode,
      currentRecipeNo,
      currentVersion,
      previousVersion,
      finishedStockItems: unassignedFinishedItems,
      componentStockItems,
      routingOperations,
      WORK_CENTERS,
      ALL_ROLES,
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
      componentsJson,
      componentStockItemId,
      quantityRequired,
      unit,
      scrapPercentage,
      operationCode,
      alternativeComponentItemId,
      alternativeNotes
    } = req.body;

    const targetMamulId = finishedStockItemId || req.body.mamulStokId;
    if (!targetMamulId) {
      throw new ValidationError('Lütfen reçetesi yazılacak ürünü seçiniz.');
    }

    const { UrunRecetesi } = require('../../models');
    const prevBoms = await UrunRecetesi.findAll({ where: { mamulStokId: targetMamulId } });
    
    let autoVersion = '1';
    if (prevBoms && prevBoms.length > 0) {
      const oldVer = prevBoms[0].versiyon || '1';
      const oldVerNum = parseInt(String(oldVer).replace(/[^0-9]/g, ''), 10) || 1;
      autoVersion = String(oldVerNum + 1);
    }
    const autoRecipeNo = await productionRepository.generateRecipeNo();

    let components = [];

    if (componentsJson) {
      try {
        components = JSON.parse(componentsJson);
      } catch (err) {
        throw new ValidationError('Bileşen verileri geçersiz formatta.');
      }
    } else if (Array.isArray(componentStockItemId)) {
      components = componentStockItemId.map((compItemId, idx) => ({
        bilesenStokId: compItemId,
        gerekliMiktar: Array.isArray(quantityRequired) ? quantityRequired[idx] : quantityRequired,
        birim: Array.isArray(unit) ? unit[idx] : unit,
        fireOrani: Array.isArray(scrapPercentage) ? scrapPercentage[idx] : scrapPercentage,
        operasyonKodu: Array.isArray(operationCode) ? operationCode[idx] : operationCode,
        alternatifBilesenStokId: Array.isArray(alternativeComponentItemId) ? alternativeComponentItemId[idx] : alternativeComponentItemId,
        alternatifNotlar: Array.isArray(alternativeNotes) ? alternativeNotes[idx] : alternativeNotes,
        notlar: Array.isArray(notes) ? notes[idx] : (Array.isArray(notlar) ? notlar[idx] : (notes || notlar))
      }));
    } else if (componentStockItemId) {
      components = [{
        bilesenStokId: componentStockItemId,
        gerekliMiktar: quantityRequired,
        birim: unit,
        fireOrani: scrapPercentage,
        operasyonKodu: operationCode,
        alternatifBilesenStokId: alternativeComponentItemId,
        alternatifNotlar: alternativeNotes,
        notlar: notes || notlar
      }];
    }

    await productionRepository.saveProductBOM(
      targetMamulId,
      {
        receteKodu: autoRecipeNo,
        version: autoVersion,
        baseQuantity: parseFloat(baseQuantity || bazMiktar) || 1.0,
        gecerlilikBaslangic: gecerlilikBaslangic || null,
        gecerlilikBitis: gecerlilikBitis || null,
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

    const processedCandidateProducts = candidateProducts.map(p => {
      const plain = p.get({ plain: true });
      plain.hasRouting = productsWithRoutingSet.has(p.id);
      return plain;
    });

    const allBOMItems = await UrunRecetesi.findAll({
      where: { mamulStokId: { [Op.in]: finishedItemIds } },
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
