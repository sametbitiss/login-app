const {
  UretimEmri,
  UretimEmriOperasyon,
  UrunRecetesi,
  StokKarti,
  SatinAlmaTalebi,
  RotaOperasyon,
  IsMerkezi,
  Atolye,
  Kullanici,
  sequelize
} = require('../../models');
const logService = require('./logService');
const productionService = require('./productionService');
const { Op } = require('sequelize');

/**
 * Birim türünün kesirli olup olmadığını belirler.
 * Adet, Paket, Koli, Set gibi birimler tam sayı olmalı.
 * Mt, Kg, Lt, M2, M3, Ton gibi birimler kesirli olabilir.
 */
function isDiscreteUnit(unit) {
  const discreteUnits = ['Adet', 'Paket', 'Koli', 'Set'];
  return discreteUnits.includes(unit);
}

class MRPService {
  /**
   * Tam Hiyerarşik MRP Motoru (v2)
   * 
   * Algoritma:
   * 1. Aktif üretim taleplerini topla (UretimEmri durum=Planned)
   * 2. Her talep ürününün reçetesini recursive olarak hammaddeye kadar patlat
   * 3. Aynı bileşenleri topla (aggregation)
   * 4. Küsürat yuvarlama (Adet birimliler Math.ceil)
   * 5. Fiziksel stok yeterliliği kontrolü
   * 6. Tedarik önerileri (Satın Alma / Üretim Talebi)
   * 7. İş emri önerileri (aşağıdan yukarı, aktif/pasif bağımlılık grafiği)
   */
  async runMRP() {
    // ═══════════════════════════════════════════════════════════════
    // ADIM 1: Veri Yükleme (tüm stoklar, reçeteler, rotalar, talepler)
    // ═══════════════════════════════════════════════════════════════
    const allStocks = await StokKarti.findAll({ order: [['ad', 'ASC']] });
    const stockMap = new Map();
    allStocks.forEach(s => stockMap.set(s.id, s));

    const allBOMs = await UrunRecetesi.findAll({
      where: { durum: 'Active' },
      include: [{ model: StokKarti, as: 'bilesenUrun' }]
    });
    // BOM'ları parent stokId'ye göre grupla, sadece Material satırlarını al
    const bomsByParent = {};
    allBOMs.forEach(b => {
      if (b.kalemTuru === 'Labor' || !b.bilesenStokId) return; // Labor satırlarını atla
      if (!bomsByParent[b.mamulStokId]) bomsByParent[b.mamulStokId] = [];
      bomsByParent[b.mamulStokId].push(b);
    });

    const allRoutings = await RotaOperasyon.findAll({
      where: { durum: 'Active' },
      order: [['stokId', 'ASC'], ['operasyonSira', 'ASC']]
    });
    const routingsByStock = {};
    allRoutings.forEach(r => {
      if (!routingsByStock[r.stokId]) routingsByStock[r.stokId] = [];
      routingsByStock[r.stokId].push(r);
    });

    // Aktif üretim taleplerini al (YALNIZCA UretimEmri, durum=Planned)
    const activeDemands = await UretimEmri.findAll({
      where: { durum: 'Planned' },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });

    if (activeDemands.length === 0) {
      return this._emptyResult();
    }

    // ═══════════════════════════════════════════════════════════════
    // ADIM 2: Her talep için Recursive BOM Explosion
    // ═══════════════════════════════════════════════════════════════
    
    // globalRequirements: { stokId -> { item, grossQty, sources: [{demandRef, parentName, qty}] } }
    const globalRequirements = new Map();
    
    // demandTrees: Her talep için tam ağaç yapısı
    const demandAnalyses = [];
    
    // intermediateProducts: Yarı mamul/mamul ürünler ve üretim miktarları
    // { stokId -> { item, totalQty, demandSources: [{demandRef, qty, parentName}] } }
    const intermediateProducts = new Map();

    for (const demand of activeDemands) {
      const st = stockMap.get(demand.stokId);
      if (!st) continue;

      const demandRef = demand.isEmriNo;
      const demandQty = parseFloat(demand.planlananMiktar || 1);
      const demandInfo = {
        demandId: demand.id,
        demandRef,
        productName: st.ad,
        productCode: st.stokKodu,
        stockId: demand.stokId,
        quantity: demandQty,
        unit: demand.birim || st.birim || 'Adet',
        priority: demand.oncelik || 'Normal',
        deliveryDate: demand.planlananBitisTarihi,
        startDate: demand.planlananBaslangicTarihi,
        title: demand.uretimBasligi
      };

      // Ana ürün kendisi de intermediateProducts'a ekle (iş emri önerisi için)
      if (!intermediateProducts.has(demand.stokId)) {
        intermediateProducts.set(demand.stokId, {
          item: st,
          totalQty: 0,
          demandSources: [],
          isTopLevel: true
        });
      }
      const ipEntry = intermediateProducts.get(demand.stokId);
      ipEntry.totalQty += demandQty;
      ipEntry.demandSources.push({ demandRef, qty: demandQty, parentName: null });

      // BOM ağacını recursive olarak patlat
      const tree = this._explodeBOM(
        demand.stokId, demandQty, demandRef, st.ad,
        stockMap, bomsByParent, globalRequirements, intermediateProducts,
        1, new Set()
      );

      demandAnalyses.push({ demand: demandInfo, tree });
    }

    // ═══════════════════════════════════════════════════════════════
    // ADIM 3 & 4: Aggregation + Küsürat Yuvarlama
    // ═══════════════════════════════════════════════════════════════
    const materialRequirements = []; // Nihai hammadde ihtiyaç tablosu

    for (const [stokId, data] of globalRequirements.entries()) {
      const item = data.item;
      let grossQty = data.grossQty;
      const unit = item.birim || 'Adet';

      // Küsürat yuvarlama: Adet gibi kesikli birimler yukarı yuvarla
      if (isDiscreteUnit(unit)) {
        grossQty = Math.ceil(grossQty);
      } else {
        grossQty = parseFloat(grossQty.toFixed(4));
      }

      const currentStock = parseFloat(item.mevcutStok || 0);
      const netShortage = Math.max(0, grossQty - currentStock);
      const isStockSufficient = netShortage === 0;

      // Net eksik de yuvarlansın
      let roundedNetShortage = netShortage;
      if (isDiscreteUnit(unit) && roundedNetShortage > 0) {
        roundedNetShortage = Math.ceil(roundedNetShortage);
      }

      const procurementMethod = item.tedarikYontemi || 'Satın Alma';

      materialRequirements.push({
        stockId: stokId,
        stockCode: item.stokKodu,
        name: item.ad,
        category: item.kategori,
        unit,
        procurementMethod,
        grossRequirement: grossQty,
        currentStock,
        netShortage: roundedNetShortage,
        isStockSufficient,
        sources: data.sources
      });
    }

    // ═══════════════════════════════════════════════════════════════
    // ADIM 5 & 6: Tedarik Önerileri
    // ═══════════════════════════════════════════════════════════════
    const purchaseSuggestions = [];
    const productionReqSuggestions = [];

    for (const req of materialRequirements) {
      if (req.isStockSufficient) continue;

      const sourceSummary = req.sources.map(s => s.demandRef).filter((v, i, a) => a.indexOf(v) === i).join(', ');

      if (req.procurementMethod === 'Satın Alma' || req.procurementMethod === 'Purchase') {
        purchaseSuggestions.push({
          stockId: req.stockId,
          stockCode: req.stockCode,
          name: req.name,
          category: req.category,
          unit: req.unit,
          grossRequirement: req.grossRequirement,
          currentStock: req.currentStock,
          netShortage: req.netShortage,
          suggestedSupplier: req.sources[0]?.item?.tedarikci || stockMap.get(req.stockId)?.tedarikci || 'Ana Tedarikçi',
          demandSources: sourceSummary,
          actionType: 'purchase',
          actionLabel: '🛒 Satın Alma Talebi Oluştur'
        });
      } else if (req.procurementMethod === 'Üretim' || req.procurementMethod === 'Production') {
        productionReqSuggestions.push({
          stockId: req.stockId,
          stockCode: req.stockCode,
          name: req.name,
          category: req.category,
          unit: req.unit,
          grossRequirement: req.grossRequirement,
          currentStock: req.currentStock,
          netShortage: req.netShortage,
          demandSources: sourceSummary,
          actionType: 'production_request',
          actionLabel: '🏭 Üretim Talebi Oluştur'
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════
    // ADIM 7: İş Emri Önerileri (Aşağıdan Yukarı Bağımlılık Grafiği)
    // ═══════════════════════════════════════════════════════════════
    const existingWorkOrders = await UretimEmri.findAll({
      where: {
        durum: { [Op.notIn]: ['Planned', 'Cancelled'] }
      },
      attributes: ['id', 'stokId', 'isEmriNo', 'durum']
    });
    const existingOrdersByStock = new Map();
    existingWorkOrders.forEach(o => {
      existingOrdersByStock.set(o.stokId, o);
    });

    const workOrderSuggestions = this._buildWorkOrderSuggestions(
      intermediateProducts, bomsByParent, stockMap, globalRequirements,
      materialRequirements, routingsByStock, existingOrdersByStock
    );

    // ═══════════════════════════════════════════════════════════════
    // ADIM 8: KPI Özeti
    // ═══════════════════════════════════════════════════════════════
    const activeWOs = workOrderSuggestions.filter(w => w.status === 'Active');
    const passiveWOs = workOrderSuggestions.filter(w => w.status === 'Passive');

    const kpiSummary = {
      totalDemandsCount: activeDemands.length,
      totalMaterialTypesCount: materialRequirements.length,
      sufficientMaterialsCount: materialRequirements.filter(m => m.isStockSufficient).length,
      shortMaterialsCount: materialRequirements.filter(m => !m.isStockSufficient).length,
      purchaseSuggestionsCount: purchaseSuggestions.length,
      productionReqSuggestionsCount: productionReqSuggestions.length,
      activeWorkOrdersCount: activeWOs.length,
      passiveWorkOrdersCount: passiveWOs.length,
      totalWorkOrdersCount: workOrderSuggestions.length
    };

    return {
      demandsAnalyzed: demandAnalyses.map(d => d.demand),
      demandAnalyses,
      materialRequirements,
      purchaseSuggestions,
      productionReqSuggestions,
      workOrderSuggestions,
      kpiSummary,
      // Geriye dönük uyumluluk aliasları
      mrpResults: materialRequirements,
      orderAnalysisTrees: demandAnalyses,
      purchaseRequisitionSuggestions: purchaseSuggestions,
      productionRequisitionSuggestions: productionReqSuggestions
    };
  }

  /**
   * Recursive BOM Explosion
   * Bir ürünün reçetesini hammaddeye kadar patlat.
   */
  _explodeBOM(parentStockId, requiredQty, demandRef, parentName, stockMap, bomsByParent, globalRequirements, intermediateProducts, depth, visited) {
    if (visited.has(parentStockId) || depth > 15) return null;
    const currentVisited = new Set(visited);
    currentVisited.add(parentStockId);

    const parentItem = stockMap.get(parentStockId);
    if (!parentItem) return null;

    const boms = bomsByParent[parentStockId] || [];
    const children = [];

    for (const bom of boms) {
      const compId = bom.bilesenStokId;
      const compItem = stockMap.get(compId);
      if (!compItem) continue;

      // Brüt ihtiyaç hesabı: (gerekliMiktar / bazMiktar) × talep × (1 + fire/100)
      const baseQty = parseFloat(bom.bazMiktar || 1) || 1;
      const unitReq = parseFloat(bom.gerekliMiktar || 1) / baseQty;
      const scrapRate = parseFloat(bom.fireOrani || 0);
      const scrapMultiplier = 1 + (scrapRate / 100);
      const compGrossReq = requiredQty * unitReq * scrapMultiplier;

      const isRawMaterial = compItem.kategori === 'Hammadde';
      const isSemiFinished = compItem.kategori === 'Yari_Mamul' || compItem.kategori === 'Yarı_Mamul';
      const isFinished = compItem.kategori === 'Mamul';

      // Global ihtiyaç tablosuna ekle
      if (!globalRequirements.has(compId)) {
        globalRequirements.set(compId, {
          item: compItem,
          grossQty: 0,
          sources: []
        });
      }
      const gEntry = globalRequirements.get(compId);
      gEntry.grossQty += compGrossReq;
      gEntry.sources.push({ demandRef, parentName, qty: compGrossReq });

      let childTree = null;

      // Eğer yarı mamul veya mamul ise → kendi reçetesini de patlat
      if (isSemiFinished || isFinished) {
        const compCurrentStock = parseFloat(compItem.mevcutStok || 0);
        let netCompReq = Math.max(0, compGrossReq - compCurrentStock);
        if (isDiscreteUnit(compItem.birim || 'Adet') && netCompReq > 0) {
          netCompReq = Math.ceil(netCompReq);
        }

        // intermediateProducts'a ekle (iş emri önerisi için)
        if (!intermediateProducts.has(compId)) {
          intermediateProducts.set(compId, {
            item: compItem,
            grossQty: 0,
            netQty: 0,
            demandSources: [],
            isTopLevel: false
          });
        }
        const ipEntry = intermediateProducts.get(compId);
        ipEntry.grossQty += compGrossReq;
        ipEntry.netQty += netCompReq;
        ipEntry.demandSources.push({ demandRef, qty: compGrossReq, netQty: netCompReq, parentName });

        // Sadece üretilmesi gereken net miktar > 0 ise alt bileşen reçetesini patlat
        if (netCompReq > 0) {
          childTree = this._explodeBOM(
            compId, netCompReq, demandRef, compItem.ad,
            stockMap, bomsByParent, globalRequirements, intermediateProducts,
            depth + 1, currentVisited
          );
        }
      }

      children.push({
        stockId: compId,
        stockCode: compItem.stokKodu,
        name: compItem.ad,
        category: compItem.kategori,
        unit: compItem.birim || 'Adet',
        procurementMethod: compItem.tedarikYontemi,
        unitRecipeQty: parseFloat(unitReq.toFixed(4)),
        scrapRate,
        grossRequired: parseFloat(compGrossReq.toFixed(4)),
        currentStock: parseFloat(compItem.mevcutStok || 0),
        depth,
        subTree: childTree
      });
    }

    return {
      stockId: parentStockId,
      stockCode: parentItem.stokKodu,
      name: parentItem.ad,
      category: parentItem.kategori,
      requiredQty: parseFloat(requiredQty.toFixed(4)),
      unit: parentItem.birim || 'Adet',
      hasBOM: boms.length > 0,
      children
    };
  }

  /**
   * Aşağıdan yukarı iş emri önerileri oluştur.
   * 
   * Mantık:
   * 1. intermediateProducts'taki tüm ürünleri (yarı mamul + mamul) tara.
   * 2. Net üretim ihtiyacını hesapla: netQty = max(0, grossQty - currentStock).
   * 3. Eğer yarı mamulün mevcut stoğu yeterliyse (netQty = 0), iş emri açmaya gerek yok.
   * 4. netQty > 0 ise, bu net miktar için bileşen stoklarını kontrol et.
   * 5. Tüm bileşenler yeterliyse → Aktif iş emri önerisi.
   * 6. Bir bileşen bile eksikse → Pasif iş emri önerisi (engeli belirt).
   * 7. Sırala: Önce alt seviyeler (yarı mamuller), sonra üst seviyeler (mamuller).
   */
  _buildWorkOrderSuggestions(intermediateProducts, bomsByParent, stockMap, globalRequirements, materialRequirements, routingsByStock, existingOrdersByStock = new Map()) {
    const suggestions = [];

    // Shortage lookup: stokId -> netShortage (materyaller arasından)
    const shortageMap = new Map();
    materialRequirements.forEach(m => {
      if (!m.isStockSufficient) {
        shortageMap.set(m.stockId, m);
      }
    });

    // Her intermediate product için iş emri önerisi oluştur
    for (const [stokId, ipData] of intermediateProducts.entries()) {
      const item = ipData.item;
      const boms = bomsByParent[stokId] || [];
      
      if (boms.length === 0) continue; // Reçetesi yoksa iş emri verilemez

      const currentStock = parseFloat(item.mevcutStok || 0);
      const grossQty = ipData.grossQty || ipData.totalQty || 0;
      let netQty = Math.max(0, grossQty - currentStock);

      if (isDiscreteUnit(item.birim || 'Adet')) {
        netQty = Math.ceil(netQty);
      }

      // Eğer yarı mamul ise ve mevcut stok zaten tüm ihtiyacı karşılıyorsa (netQty <= 0) iş emri açmaya gerek yok
      if (!ipData.isTopLevel && netQty <= 0) {
        continue;
      }

      // Üretilecek miktar: Net ihtiyaç (eğer top-level ise talep miktarı ya da net eksik)
      const productionQty = netQty > 0 ? netQty : grossQty;
      let roundedQty = productionQty;
      if (isDiscreteUnit(item.birim || 'Adet')) {
        roundedQty = Math.ceil(productionQty);
      }

      // Bu ürün için zaten aktif veya tamamlanmış bir iş emri var mı kontrol et
      const existingOrder = (existingOrdersByStock && existingOrdersByStock.get(stokId)) || null;
      const hasExistingOrder = !!existingOrder;

      // Bu ürünün net üretim miktarı için doğrudan bileşenlerini kontrol et
      const blockers = [];
      let allComponentsReady = true;

      for (const bom of boms) {
        const compId = bom.bilesenStokId;
        const compItem = stockMap.get(compId);
        if (!compItem) continue;

        const baseQty = parseFloat(bom.bazMiktar || 1) || 1;
        const unitReq = parseFloat(bom.gerekliMiktar || 1) / baseQty;
        const scrapRate = parseFloat(bom.fireOrani || 0);
        const scrapMultiplier = 1 + (scrapRate / 100);
        const neededQty = roundedQty * unitReq * scrapMultiplier;

        const compCurrentStock = parseFloat(compItem.mevcutStok || 0);

        // Bileşen yeterli mi?
        if (compCurrentStock < neededQty) {
          allComponentsReady = false;
          const isSemiOrFinished = ['Yari_Mamul', 'Yarı_Mamul', 'Mamul'].includes(compItem.kategori);
          blockers.push({
            stockId: compId,
            stockCode: compItem.stokKodu,
            name: compItem.ad,
            category: compItem.kategori,
            needed: parseFloat(neededQty.toFixed(2)),
            available: compCurrentStock,
            shortage: parseFloat((neededQty - compCurrentStock).toFixed(2)),
            blockerType: isSemiOrFinished ? 'production' : 'purchase',
            blockerLabel: isSemiOrFinished
              ? `🏭 Önce "${compItem.ad}" üretilmeli`
              : `🛒 "${compItem.ad}" satın alınmalı`
          });
        }
      }

      // Rota bilgisi
      const routings = routingsByStock[stokId] || [];
      const primaryWorkCenter = routings.length > 0
        ? (routings[0].isMerkezi || 'Genel Üretim')
        : 'Genel Üretim';

      let estimatedHours = 0;
      if (routings.length > 0) {
        estimatedHours = routings.reduce((sum, r) => {
          const setupMins = parseFloat(r.hazirlikSuresiDakika || 0);
          const unitMins = parseFloat(r.calismaSuresiDakikaBirim || 0);
          return sum + ((setupMins + (unitMins * roundedQty)) / 60);
        }, 0);
      }

      const demandSourceRefs = ipData.demandSources
        .map(s => s.demandRef)
        .filter((v, i, a) => a.indexOf(v) === i)
        .join(', ');

      const isTopLevel = ipData.isTopLevel;
      const depth = isTopLevel ? 0 : 1; // 0 = mamul, 1 = yarı mamul

      let status = allComponentsReady ? 'Active' : 'Passive';
      let statusLabel = allComponentsReady
        ? '🟢 Bileşenler Hazır — İş Emri Açılabilir'
        : '🟡 Beklemede — Alt Bileşen Eksik';

      if (hasExistingOrder) {
        status = 'HasExistingOrder';
        statusLabel = `⚠️ İş Emri Mevcut ([${existingOrder.isEmriNo}] • ${existingOrder.durum})`;
      }

      suggestions.push({
        stockId: stokId,
        stockCode: item.stokKodu,
        name: item.ad,
        category: item.kategori,
        quantity: roundedQty,
        grossRequirement: grossQty,
        currentStock,
        netRequirement: roundedQty,
        unit: item.birim || 'Adet',
        status,
        statusLabel,
        hasExistingOrder,
        existingWorkOrderNo: existingOrder ? existingOrder.isEmriNo : null,
        existingOrderStatus: existingOrder ? existingOrder.durum : null,
        isTopLevel,
        depth,
        blockers,
        workCenter: primaryWorkCenter,
        estimatedHours: parseFloat(estimatedHours.toFixed(1)),
        demandSources: demandSourceRefs,
        priority: ipData.demandSources.length > 0 ? 'Normal' : 'Low'
      });
    }

    // Sırala: önce alt seviyeler (depth DESC → yarı mamuller önce), sonra üst seviyeler
    suggestions.sort((a, b) => {
      if (a.depth !== b.depth) return b.depth - a.depth; // Yarı mamuller önce
      return a.name.localeCompare(b.name, 'tr');
    });

    // Öncelik numarası ata (1 = en önce yapılacak)
    suggestions.forEach((s, idx) => {
      s.priorityOrder = idx + 1;
    });

    return suggestions;
  }

  /**
   * Boş sonuç döndür (talep yokken)
   */
  _emptyResult() {
    const emptyKpi = {
      totalDemandsCount: 0,
      totalMaterialTypesCount: 0,
      sufficientMaterialsCount: 0,
      shortMaterialsCount: 0,
      purchaseSuggestionsCount: 0,
      productionReqSuggestionsCount: 0,
      activeWorkOrdersCount: 0,
      passiveWorkOrdersCount: 0,
      totalWorkOrdersCount: 0
    };
    return {
      demandsAnalyzed: [],
      demandAnalyses: [],
      materialRequirements: [],
      purchaseSuggestions: [],
      productionReqSuggestions: [],
      workOrderSuggestions: [],
      kpiSummary: emptyKpi,
      mrpResults: [],
      orderAnalysisTrees: [],
      purchaseRequisitionSuggestions: [],
      productionRequisitionSuggestions: []
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // MRP Önerilerini Uygula (Satın Alma Talebi / İş Emri Oluştur)
  // ═══════════════════════════════════════════════════════════════
  async executeMRPRecommendations(options = {}, currentUser = null, ipAddress = null) {
    const { createPurchaseReqs = true, createWorkOrders = false, selectedStockIds = null } = options;
    const mrpData = await this.runMRP();

    const createdRecords = {
      purchaseRequisitions: [],
      workOrders: []
    };

    // 1. Satın Alma Talepleri Oluştur
    if (createPurchaseReqs && mrpData.purchaseSuggestions.length > 0) {
      for (const item of mrpData.purchaseSuggestions) {
        if (selectedStockIds && !selectedStockIds.includes(item.stockId)) continue;

        const nextReqNo = `TAL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
        const req = await SatinAlmaTalebi.create({
          talepNo: nextReqNo,
          kaynakModul: 'Production',
          talepEdenAdi: currentUser ? (currentUser.ad ? `${currentUser.ad} ${currentUser.soyad || ''}` : currentUser.kullaniciAdi) : 'MRP Motoru',
          stokId: item.stockId,
          talepEdilenMiktar: item.netShortage,
          birim: item.unit,
          aciliyet: 'Normal',
          durum: 'Approved',
          notlar: `[Otomatik MRP] Net Eksik: ${item.netShortage} ${item.unit} (Brüt İhtiyaç: ${item.grossRequirement}, Stok: ${item.currentStock}). Kaynak Talepler: ${item.demandSources}`,
          olusturanId: currentUser ? currentUser.id : null
        });

        await logService.logCrud({
          kullaniciId: currentUser ? currentUser.id : null,
          kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'MRP Engine',
          islem: 'CREATE',
          varlik: 'SatinAlmaTalebi',
          varlikId: req.id,
          detaylar: { talepNo: req.talepNo, stokId: req.stokId, miktar: req.talepEdilenMiktar, kaynak: 'MRP_V2' },
          ipAdresi: ipAddress
        });

        createdRecords.purchaseRequisitions.push(req);
      }
    }

    // 2. İş Emirleri Oluştur
    if (createWorkOrders && mrpData.workOrderSuggestions.length > 0) {
      const year = new Date().getFullYear();
      for (const item of mrpData.workOrderSuggestions) {
        if (selectedStockIds && !selectedStockIds.includes(item.stockId)) continue;
        if (item.status !== 'Active' || item.hasExistingOrder) continue; // Sadece aktif ve daha önce iş emri açılmamış olanları oluştur

        // Mükerrer iş emri kontrolü: Bu ürün için zaten aktif veya tamamlanmış iş emri varsa atla
        const existingActiveWO = await UretimEmri.findOne({
          where: {
            stokId: item.stockId,
            durum: { [Op.notIn]: ['Planned', 'Cancelled'] }
          }
        });
        if (existingActiveWO) continue;

        const prefix = `ISEMRI-${year}-`;
        const lastOrder = await UretimEmri.findOne({
          where: { isEmriNo: { [Op.like]: `${prefix}%` } },
          order: [['id', 'DESC']]
        });
        let nextSeq = 1;
        if (lastOrder) {
          const lastNoStr = lastOrder.isEmriNo.replace(prefix, '');
          nextSeq = (parseInt(lastNoStr, 10) || 0) + 1;
        }
        const workOrderNo = `${prefix}${String(nextSeq).padStart(4, '0')}`;

        const todayStr = new Date().toISOString().split('T')[0];
        const deliveryDate = new Date();
        deliveryDate.setDate(deliveryDate.getDate() + 7);
        const deliveryDateStr = deliveryDate.toISOString().split('T')[0];

        const wo = await UretimEmri.create({
          isEmriNo: workOrderNo,
          uretimBasligi: `🏭 [MRP İş Emri] ${item.name} (${item.quantity} ${item.unit})`,
          stokId: item.stockId,
          planlananMiktar: item.quantity,
          tamamlananMiktar: 0,
          fireMiktari: 0,
          birim: item.unit,
          durum: 'Approved',
          oncelik: item.priority || 'Normal',
          isMerkezi: item.workCenter || 'Genel Üretim',
          planlananBaslangicTarihi: todayStr,
          planlananBitisTarihi: deliveryDateStr,
          tahminiSaat: item.estimatedHours || 4,
          receteNotlari: `Kaynak Talepler: ${item.demandSources}`,
          notlar: `[MRP v2 İş Emri] Bileşenleri tam olan ürünün iş emridir. Öncelik sırası: #${item.priorityOrder}`,
          olusturanId: currentUser ? currentUser.id : null
        });

        await logService.logCrud({
          kullaniciId: currentUser ? currentUser.id : null,
          kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'MRP Engine',
          islem: 'CREATE',
          varlik: 'UretimEmri',
          varlikId: wo.id,
          detaylar: { isEmriNo: wo.isEmriNo, stokId: wo.stokId, miktar: wo.planlananMiktar, kaynak: 'MRP_V2' },
          ipAdresi: ipAddress
        });

        // İş emrini rota operasyonlarına parçala ve iş merkezlerine dağıt
        await productionService.createWorkOrderOperations(wo);

        createdRecords.workOrders.push(wo);
      }
    }

    return createdRecords;
  }

  // Geriye dönük uyumluluk
  async generateRequisitions(mrpResults, currentUser = null) {
    return await this.executeMRPRecommendations({ createPurchaseReqs: true }, currentUser);
  }

  async calculateCapacityLoad() {
    // 1. Fetch all real Work Centers from DB with workshop, workshop supervisor and creator
    const dbWorkCenters = await IsMerkezi.findAll({
      include: [
        { 
          model: Atolye, 
          as: 'atolye',
          include: [{ model: Kullanici, as: 'sorumlu' }]
        },
        { model: Kullanici, as: 'olusturan' }
      ],
      order: [['isMerkeziKodu', 'ASC'], ['id', 'ASC']]
    });

    // 2. Fetch all eligible employees (rol = 'Employee')
    const allEmployees = await Kullanici.findAll({
      where: { rol: 'Employee' },
      order: [['ad', 'ASC'], ['kullaniciAdi', 'ASC']]
    });

    // 3. Fetch all active/pending operation steps from DB
    const allOperations = await UretimEmriOperasyon.findAll({
      where: {
        durum: { [Op.in]: ['Ready', 'Waiting_Previous_Op', 'In_Production', 'Paused'] }
      },
      include: [
        { 
          model: UretimEmri, 
          as: 'uretimEmri',
          include: [{ model: Kullanici, as: 'olusturan' }]
        },
        { model: StokKarti, as: 'stokKarti' },
        { model: UretimEmriOperasyon, as: 'oncekiOperasyon' },
        { model: IsMerkezi, as: 'isMerkeziKarti' }
      ],
      order: [
        ['operasyonSira', 'ASC'],
        ['id', 'ASC']
      ]
    });

    // 4. Process each work center
    const report = dbWorkCenters.map(wc => {
      const dailyCapacityHours = parseFloat(wc.gunlukCalismaSaati || 8);
      const horizonCapacityHours = dailyCapacityHours * 5;

      // Find operations assigned to this work center
      const stationOperations = allOperations.filter(op => {
        if (op.isMerkeziId && Number(op.isMerkeziId) === Number(wc.id)) return true;
        if (!op.isMerkezi) return false;
        const opCenter = op.isMerkezi.trim();
        const code = wc.isMerkeziKodu ? wc.isMerkeziKodu.trim() : '';
        const name = wc.isMerkeziAdi ? wc.isMerkeziAdi.trim() : '';
        return (
          opCenter === code ||
          opCenter === name ||
          (code && opCenter.includes(code)) ||
          (name && opCenter.includes(name))
        );
      });

      // Split into active running operation and queued operations
      const activeRunningOp = stationOperations.find(o => o.durum === 'In_Production' || o.durum === 'Paused') || null;
      const queuedOps = stationOperations.filter(o => o !== activeRunningOp);

      const readyOpsCount = queuedOps.filter(o => o.durum === 'Ready').length;
      const waitingOpsCount = queuedOps.filter(o => o.durum === 'Waiting_Previous_Op').length;

      // Determine operational status
      let operationalStatus = 'Idle'; // 'Idle', 'Busy', 'Paused', 'Maintenance', 'Inactive'
      let statusLabel = '🟢 Boş (Müsait)';
      let statusBadgeClass = 'status-approved';

      if (['Maintenance', 'Bakim', 'Bakımda', 'Fault', 'Arızalı', 'Arizali'].includes(wc.durum)) {
        operationalStatus = 'Maintenance';
        statusLabel = '🛠️ Bakımda / Arızalı';
        statusBadgeClass = 'status-rejected';
      } else if (wc.durum === 'Inactive') {
        operationalStatus = 'Inactive';
        statusLabel = '⛔ Pasif';
        statusBadgeClass = 'status-pending';
      } else if (activeRunningOp) {
        if (activeRunningOp.durum === 'Paused') {
          operationalStatus = 'Paused';
          statusLabel = '⏸️ Duraklatıldı';
          statusBadgeClass = 'status-pending';
        } else {
          operationalStatus = 'Busy';
          statusLabel = '⚡ Meşgul (Üretimde)';
          statusBadgeClass = 'status-completed';
        }
      } else {
        operationalStatus = 'Idle';
        statusLabel = '🟢 Boş (Müsait)';
        statusBadgeClass = 'status-approved';
      }

      // Calculate allocated hours from standard operation times
      const allocatedHours = stationOperations.reduce((sum, op) => {
        const plannedQty = parseFloat(op.planlananMiktar || 1);
        const completedQty = parseFloat(op.tamamlananMiktar || 0);
        const remainingQty = Math.max(0, plannedQty - completedQty);
        const setupMin = parseFloat(op.hazirlikSuresiDakika || 15);
        const unitRunMin = parseFloat(op.calismaSuresiDakikaBirim || 5);
        const opTotalMin = setupMin + (unitRunMin * remainingQty);
        return sum + (opTotalMin / 60);
      }, 0);

      const loadPercentage = horizonCapacityHours > 0 
        ? Math.min(100, Math.round((allocatedHours / horizonCapacityHours) * 100))
        : 0;
      const isBottleneck = loadPercentage > 85;

      // Station supervisor / responsible person from connected Atolye
      const atolyeSorumlu = wc.atolye && wc.atolye.sorumlu 
        ? (wc.atolye.sorumlu.ad ? `${wc.atolye.sorumlu.ad} ${wc.atolye.sorumlu.soyad || ''}`.trim() : wc.atolye.sorumlu.kullaniciAdi)
        : null;

      // Active operator / personnel info
      const activePersonnel = activeRunningOp 
        ? (activeRunningOp.operatorAdi || atolyeSorumlu)
        : atolyeSorumlu;

      // Assigned shift personnel objects
      let rawPersonnelIds = wc.atananPersonelIds;
      if (typeof rawPersonnelIds === 'string') {
        try { rawPersonnelIds = JSON.parse(rawPersonnelIds); } catch (_) { rawPersonnelIds = []; }
      }
      const assignedIds = Array.isArray(rawPersonnelIds) ? rawPersonnelIds.map(Number).filter(Boolean) : [];

      const assignedPersonnelList = allEmployees.filter(e => assignedIds.includes(Number(e.id))).map(e => ({
        id: e.id,
        ad: e.ad,
        soyad: e.soyad,
        fullName: e.ad ? `${e.ad} ${e.soyad || ''}`.trim() : e.kullaniciAdi,
        kullaniciAdi: e.kullaniciAdi,
        departman: e.departman || 'Genel Personel',
        unvan: e.unvan || 'Personel'
      }));

      // Helper to format operation for capacity cards with complete dual-language and nested structures
      const formatOperationForCapacity = (op) => {
        if (!op) return null;
        const plannedQty = parseFloat(op.planlananMiktar || 1);
        const completedQty = parseFloat(op.tamamlananMiktar || 0);
        const remainingQty = Math.max(0, plannedQty - completedQty);
        const setupMin = parseFloat(op.hazirlikSuresiDakika || 15);
        const unitRunMin = parseFloat(op.calismaSuresiDakikaBirim || 5);
        const totalEstMin = Math.round(setupMin + (unitRunMin * plannedQty));
        const remainingMin = Math.round(setupMin + (unitRunMin * remainingQty));
        const estHours = parseFloat((totalEstMin / 60).toFixed(2));
        const remainingHours = parseFloat((remainingMin / 60).toFixed(2));

        const stock = op.stokKarti || op.uretimEmri?.stokKarti;
        const stockCode = stock ? stock.stokKodu : '—';
        const stockName = stock ? stock.ad : (op.uretimEmri ? op.uretimEmri.uretimBasligi : 'Mamul');
        const prevOp = op.oncekiOperasyon;
        const isLocked = op.durum === 'Waiting_Previous_Op';
        const lockReason = isLocked 
          ? (prevOp ? `Önceki Adım: "${prevOp.operasyonAdi}" (#${prevOp.operasyonSira}) Bekleniyor` : 'Önceki Operasyonun Tamamlanması Bekleniyor')
          : null;

        return {
          id: op.id,
          operationId: op.id,
          workOrderId: op.uretimEmriId,
          isEmriNo: op.isEmriNo,
          workOrderNo: op.isEmriNo,
          uretimBasligi: op.uretimEmri ? op.uretimEmri.uretimBasligi : op.operasyonAdi,
          productionTitle: op.uretimEmri ? op.uretimEmri.uretimBasligi : op.operasyonAdi,
          operasyonAdi: op.operasyonAdi,
          operationName: op.operasyonAdi,
          operasyonKodu: op.operasyonKodu,
          operationCode: op.operasyonKodu,
          operasyonSira: op.operasyonSira,
          operationSeq: op.operasyonSira,
          stokId: op.stokId,
          stokKodu: stockCode,
          stockCode: stockCode,
          stokAdi: stockName,
          stockName: stockName,
          stokKarti: stock ? { id: stock.id, stokKodu: stockCode, ad: stockName } : { id: op.stokId, stokKodu: stockCode, ad: stockName },
          planlananMiktar: plannedQty,
          plannedQuantity: plannedQty,
          tamamlananMiktar: completedQty,
          completedQuantity: completedQty,
          kalanMiktar: remainingQty,
          remainingQuantity: remainingQty,
          birim: op.birim || 'Adet',
          unit: op.birim || 'Adet',
          durum: op.durum,
          status: op.durum,
          oncelik: op.uretimEmri ? op.uretimEmri.oncelik : 'Normal',
          priority: op.uretimEmri ? op.uretimEmri.oncelik : 'Normal',
          tahminiSaat: estHours,
          estimatedHours: estHours,
          tahminiDakika: totalEstMin,
          kalanSaat: remainingHours,
          kalanDakika: remainingMin,
          isReady: op.durum === 'Ready',
          isLocked,
          lockReason,
          operatorAdi: op.operatorAdi || 'Operatör',
          operatorName: op.operatorAdi || 'Operatör',
          planlananBaslangicTarihi: op.uretimEmri?.planlananBaslangicTarihi || new Date().toISOString().split('T')[0],
          planlananBitisTarihi: op.uretimEmri?.planlananBitisTarihi || new Date().toISOString().split('T')[0]
        };
      };

      const formattedActiveOrder = formatOperationForCapacity(activeRunningOp);
      const formattedQueuedOrders = queuedOps.map(formatOperationForCapacity);

      return {
        id: wc.id,
        workCenterCode: wc.isMerkeziKodu,
        workCenterName: wc.isMerkeziAdi,
        atolyeName: wc.atolye ? wc.atolye.atolyeAdi : 'Genel Atölye',
        stationSupervisor: atolyeSorumlu,
        rawStatus: wc.durum,
        operationalStatus,
        statusLabel,
        statusBadgeClass,
        dailyCapacityHours,
        horizonCapacityHours,
        allocatedHours: parseFloat(allocatedHours.toFixed(1)),
        availableHours: Math.max(0, parseFloat((horizonCapacityHours - allocatedHours).toFixed(1))),
        loadPercentage,
        activeOrdersCount: stationOperations.length,
        readyOpsCount,
        waitingOpsCount,
        isBottleneck,
        workersCount: wc.varsayilanIsciSayisi || 1,
        assignedPersonnelIds: assignedIds,
        assignedPersonnelList,
        activeRunningOrder: formattedActiveOrder,
        queuedOrders: formattedQueuedOrders,
        activePersonnel
      };
    });

    return {
      report,
      allEmployees: allEmployees.map(e => ({
        id: e.id,
        ad: e.ad,
        soyad: e.soyad,
        fullName: e.ad ? `${e.ad} ${e.soyad || ''}`.trim() : e.kullaniciAdi,
        kullaniciAdi: e.kullaniciAdi,
        departman: e.departman || 'Genel Personel',
        unvan: e.unvan || 'Personel'
      }))
    };
  }
}

module.exports = new MRPService();
