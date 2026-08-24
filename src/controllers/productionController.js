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
      mrpResults: (mrpData.materialRequirements || []).slice(0, 5),
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
    const { stockId, stockItemId, plannedQty, qty, requisitionId, requisitionNo, demandRef, priority } = req.query;
    const { StokKarti, UretimEmri, UrunRecetesi, RotaOperasyon, SatisSiparisi, sequelize } = require('../../models');
    const { Op } = require('sequelize');

    const effectiveStockId = stockId || stockItemId;
    const effectiveQty = parseFloat(plannedQty || qty || 1) || 1;
    const effectivePriority = priority || 'Normal';
    const effectiveDemandRef = requisitionNo || demandRef || '';

    // 1. Fetch all candidate manufactured products (Mamul & Yarı Mamul)
    const stockItems = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'] }
      },
      order: [['ad', 'ASC']]
    });

    let targetProduct = null;
    let routingOperations = [];
    let activeRecipeCode = '—';
    let activeRecipeVersion = 'Rev.01';
    let activeRoutingCode = '—';
    let totalSetupMins = 0;
    let totalRunMins = 0;
    let totalDurationMins = 0;
    let totalDurationHours = 0;
    let primaryWorkCenter = WORK_CENTERS[0];
    let projectedStartDate = new Date().toISOString().split('T')[0];
    let projectedEndDate = projectedStartDate;
    let workCenterStatusText = '🟢 İş İstasyonu Müsait (Hemen Başlayabilir)';
    let isWorkCenterBusy = false;
    let calculatedComponents = [];
    let deliveryDate = null;
    let hasDeliveryDate = false;
    let isDeliveryDelayed = false;
    let delayDays = 0;

    if (effectiveStockId) {
      targetProduct = await StokKarti.findByPk(effectiveStockId);
      if (targetProduct) {
        // 2. Fetch Active BOM
        const rawBOMs = await UrunRecetesi.findAll({
          where: { mamulStokId: targetProduct.id, durum: 'Active' },
          include: [{ model: StokKarti, as: 'bilesenUrun' }],
          order: [
            [sequelize.cast(sequelize.col('UrunRecetesi.operasyonKodu'), 'INTEGER'), 'ASC'],
            ['id', 'ASC']
          ]
        });

        if (rawBOMs.length > 0) {
          activeRecipeCode = rawBOMs[0].receteKodu || 'REC-TANIMLI';
          activeRecipeVersion = rawBOMs[0].versiyon || 'Rev.01';
        }

        // 3. Fetch Active Routings
        routingOperations = await RotaOperasyon.findAll({
          where: { stokId: targetProduct.id, durum: 'Active' },
          order: [['operasyonSira', 'ASC']]
        });

        if (routingOperations.length > 0) {
          activeRoutingCode = routingOperations[0].rotaKodu || `ROTA-${targetProduct.stokKodu}`;
          primaryWorkCenter = routingOperations[0].isMerkezi || WORK_CENTERS[0];
        }

        // 4. Calculate Operation Times
        const processedOps = routingOperations.map(op => {
          const setupM = parseFloat(op.hazirlikSuresiDakika || 0);
          const runMPerUnit = parseFloat(op.calismaSuresiDakikaBirim || 0);
          const opTotalRunM = runMPerUnit * effectiveQty;
          const opTotalMins = setupM + opTotalRunM;
          const opTotalHours = parseFloat((opTotalMins / 60).toFixed(2));

          totalSetupMins += setupM;
          totalRunMins += opTotalRunM;
          totalDurationMins += opTotalMins;

          return {
            id: op.id,
            operasyonSira: op.operasyonSira,
            operasyonKodu: op.operasyonKodu,
            operasyonAdi: op.operasyonAdi,
            isMerkezi: op.isMerkezi || primaryWorkCenter,
            hazirlikSuresiDakika: setupM,
            calismaSuresiDakikaBirim: runMPerUnit,
            toplamCalismaDakika: parseFloat(opTotalRunM.toFixed(1)),
            toplamDakika: parseFloat(opTotalMins.toFixed(1)),
            toplamSaat: opTotalHours,
            operatorSayisi: op.operatorSayisi || 1,
            talimatlar: op.talimatlar
          };
        });

        totalDurationHours = parseFloat((totalDurationMins / 60).toFixed(1));

        // 5. Work Center Schedule / Queue check
        const uniqueWorkCenters = Array.from(new Set(routingOperations.map(r => r.isMerkezi).filter(Boolean)));
        if (uniqueWorkCenters.length > 0) {
          const activeWOsInCenters = await UretimEmri.findAll({
            where: {
              durum: { [Op.in]: ['Approved', 'In_Production'] },
              isMerkezi: { [Op.in]: uniqueWorkCenters }
            },
            order: [['planlananBitisTarihi', 'DESC']]
          });

          if (activeWOsInCenters.length > 0) {
            isWorkCenterBusy = true;
            const latestEnd = activeWOsInCenters[0].planlananBitisTarihi;
            if (latestEnd && new Date(latestEnd) >= new Date()) {
              projectedStartDate = new Date(latestEnd).toISOString().split('T')[0];
              workCenterStatusText = `🟡 İş İstasyonunda Aktif İşler Var (En erken başlama: ${projectedStartDate})`;
            }
          }
        }

        // 6. Calculate Projected End Date
        const standardDailyShiftHours = 8;
        const workDaysNeeded = Math.max(1, Math.ceil(totalDurationHours / standardDailyShiftHours));
        const startDateObj = new Date(projectedStartDate);
        startDateObj.setDate(startDateObj.getDate() + workDaysNeeded);
        projectedEndDate = startDateObj.toISOString().split('T')[0];

        // 7. Calculate Components with scrap and discrete rounding
        calculatedComponents = rawBOMs.map(bom => {
          const comp = bom.bilesenUrun;
          const isLabor = bom.kalemTuru === 'Labor' || !comp;
          const baseQty = parseFloat(bom.bazMiktar || 1) || 1;
          const reqQty = parseFloat(bom.gerekliMiktar || 0);
          const scrapRate = parseFloat(bom.fireOrani || 0);
          const scrapMultiplier = 1 + (scrapRate / 100);

          let grossReq = 0;
          let roundedGrossReq = 0;
          let currentStock = 0;
          let isSufficient = true;
          let compUnit = bom.birim || 'Adet';

          if (!isLabor && comp) {
            compUnit = comp.birim || bom.birim || 'Adet';
            grossReq = effectiveQty * (reqQty / baseQty) * scrapMultiplier;
            const discrete = ['Adet', 'Paket', 'Koli', 'Set'].includes(compUnit);
            roundedGrossReq = discrete ? Math.ceil(grossReq) : parseFloat(grossReq.toFixed(2));
            currentStock = parseFloat(comp.mevcutStok || 0);
            isSufficient = currentStock >= roundedGrossReq;
          }

          // Match operation in routing
          const matchingOp = routingOperations.find(r => 
            (bom.operasyonKodu && (r.operasyonKodu === bom.operasyonKodu || String(r.operasyonSira) === String(bom.operasyonKodu)))
          );

          return {
            id: bom.id,
            kalemTuru: bom.kalemTuru,
            isLabor,
            operasyonKodu: bom.operasyonKodu || '10',
            operasyonAdi: matchingOp ? matchingOp.operasyonAdi : `Adım #${bom.operasyonKodu || '10'}`,
            isMerkezi: matchingOp ? matchingOp.isMerkezi : primaryWorkCenter,
            bilesenStokId: bom.bilesenStokId,
            bilesenKodu: comp ? comp.stokKodu : '—',
            bilesenAdi: comp ? comp.ad : (isLabor ? `[İşçilik / Operasyon Adımı #${bom.operasyonKodu}]` : '—'),
            kategori: comp ? comp.kategori : 'Hizmet/İşçilik',
            tedarikYontemi: comp ? comp.tedarikYontemi : '—',
            birim: compUnit,
            bazMiktar: baseQty,
            gerekliMiktar: reqQty,
            fireOrani: scrapRate,
            hesaplananBrutMiktar: grossReq,
            yuvarlanmisMiktar: roundedGrossReq,
            mevcutStok: currentStock,
            stokYeterli: isSufficient
          };
        });

        // 8. Delivery Date & Delay Check
        if (effectiveDemandRef) {
          const srcDemand = await UretimEmri.findOne({ where: { isEmriNo: effectiveDemandRef } });
          if (srcDemand && srcDemand.planlananBitisTarihi) {
            deliveryDate = srcDemand.planlananBitisTarihi;
            hasDeliveryDate = true;
          } else {
            const srcSale = await SatisSiparisi.findOne({ where: { siparisNo: effectiveDemandRef } });
            if (srcSale && (srcSale.teslimTarihi || srcSale.siparisTarihi)) {
              deliveryDate = srcSale.teslimTarihi || srcSale.siparisTarihi;
              hasDeliveryDate = true;
            }
          }

          if (hasDeliveryDate && deliveryDate) {
            const projectedEndTs = new Date(projectedEndDate).getTime();
            const deliveryTs = new Date(deliveryDate).getTime();
            if (projectedEndTs > deliveryTs) {
              isDeliveryDelayed = true;
              delayDays = Math.ceil((projectedEndTs - deliveryTs) / (1000 * 60 * 60 * 24));
            }
          }
        }

        routingOperations = processedOps;
      }
    }

    const nextWorkOrderNo = await productionRepository.generateWorkOrderNo();

    res.render('production/add', {
      user: req.user,
      stockItems,
      targetProduct,
      effectiveStockId,
      effectiveQty,
      effectivePriority,
      effectiveDemandRef,
      nextWorkOrderNo,
      activeRecipeCode,
      activeRecipeVersion,
      activeRoutingCode,
      routingOperations,
      totalSetupMins: parseFloat(totalSetupMins.toFixed(1)),
      totalRunMins: parseFloat(totalRunMins.toFixed(1)),
      totalDurationMins: parseFloat(totalDurationMins.toFixed(1)),
      totalDurationHours,
      primaryWorkCenter,
      projectedStartDate,
      projectedEndDate,
      workCenterStatusText,
      isWorkCenterBusy,
      calculatedComponents,
      deliveryDate,
      hasDeliveryDate,
      isDeliveryDelayed,
      delayDays,
      WORK_CENTERS,
      ALL_ROLES,
      activeSubTab: 'add_order',
      error: null
    });
  });

  addOrder = asyncHandler(async (req, res) => {
    const {
      isEmriNo,
      uretimBasligi,
      stockItemId,
      stockId,
      plannedQuantity,
      unit,
      priority,
      workCenter,
      plannedStartDate,
      plannedEndDate,
      estimatedHours,
      productionManager,
      receteNotlari,
      notlar,
      demandRef
    } = req.body;

    const { UretimEmri, StokKarti } = require('../../models');

    const sId = parseInt(stockId || stockItemId, 10);
    const targetProduct = await StokKarti.findByPk(sId);
    if (!targetProduct) {
      throw new ValidationError('Geçerli bir ürün seçilmelidir.');
    }

    const nextNo = isEmriNo || (await productionRepository.generateWorkOrderNo());
    const qty = parseFloat(plannedQuantity) || 1;
    const title = uretimBasligi || `🏭 [İş Emri] ${targetProduct.ad} (${qty} ${unit || targetProduct.birim || 'Adet'})`;

    await productionRepository.create({
      isEmriNo: nextNo,
      uretimBasligi: title,
      stokId: sId,
      planlananMiktar: qty,
      birim: unit || targetProduct.birim || 'Adet',
      durum: 'Approved',
      oncelik: priority || 'Normal',
      isMerkezi: workCenter || 'İstasyon-1 (Genel Montaj)',
      planlananBaslangicTarihi: plannedStartDate || new Date().toISOString().split('T')[0],
      planlananBitisTarihi: plannedEndDate || new Date().toISOString().split('T')[0],
      tahminiSaat: parseFloat(estimatedHours) || 0,
      uretimYonetici: productionManager || (req.user ? `${req.user.ad || ''} ${req.user.soyad || ''}`.trim() : 'Üretim Mühendisi'),
      receteNotlari: receteNotlari || `Kaynak: ${demandRef || 'Manuel'}`,
      notlar: notlar || `[Yeni İş Emri] Kaynak Talep: ${demandRef || 'Doğrudan Giriş'}`
    }, req.user, req.ip);

    res.redirect('/production/orders?success=order_created');
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
      materialRequirements: mrpData.materialRequirements || [],
      workOrderSuggestions: mrpData.workOrderSuggestions || [],
      purchaseSuggestions: mrpData.purchaseSuggestions || [],
      productionReqSuggestions: mrpData.productionReqSuggestions || [],
      demandAnalyses: mrpData.demandAnalyses || [],
      kpiSummary: mrpData.kpiSummary || {},
      demandsAnalyzed: mrpData.demandsAnalyzed || [],
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

        const { sequelize } = require('../../models');
        existingBOMItems = await UrunRecetesi.findAll({
          where: { mamulStokId: finishedStockItemId },
          include: [
            { model: StokKarti, as: 'bilesenUrun' }
          ],
          order: [
            [sequelize.cast(sequelize.col('operasyonKodu'), 'INTEGER'), 'ASC'],
            ['id', 'ASC']
          ]
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
