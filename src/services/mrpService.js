const {
  UretimEmri,
  UrunRecetesi,
  StokKarti,
  SatinAlmaTalebi,
  RotaOperasyon,
  sequelize
} = require('../../models');
const logService = require('./logService');
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
    const workOrderSuggestions = this._buildWorkOrderSuggestions(
      intermediateProducts, bomsByParent, stockMap, globalRequirements,
      materialRequirements, routingsByStock
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
        // intermediateProducts'a ekle (iş emri önerisi için)
        if (!intermediateProducts.has(compId)) {
          intermediateProducts.set(compId, {
            item: compItem,
            totalQty: 0,
            demandSources: [],
            isTopLevel: false
          });
        }
        const ipEntry = intermediateProducts.get(compId);
        ipEntry.totalQty += compGrossReq;
        ipEntry.demandSources.push({ demandRef, qty: compGrossReq, parentName });

        // Recursive çağrı
        childTree = this._explodeBOM(
          compId, compGrossReq, demandRef, compItem.ad,
          stockMap, bomsByParent, globalRequirements, intermediateProducts,
          depth + 1, currentVisited
        );
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
   * 2. Her birinin doğrudan bileşenlerinin stok durumunu kontrol et.
   * 3. Tüm bileşenler yeterliyse → Aktif iş emri önerisi.
   * 4. Bir bileşen bile eksikse → Pasif iş emri önerisi (engeli belirt).
   * 5. Sırala: Önce alt seviyeler (yarı mamuller), sonra üst seviyeler (mamuller).
   */
  _buildWorkOrderSuggestions(intermediateProducts, bomsByParent, stockMap, globalRequirements, materialRequirements, routingsByStock) {
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

      const totalQty = ipData.totalQty;
      let roundedQty = totalQty;
      if (isDiscreteUnit(item.birim || 'Adet')) {
        roundedQty = Math.ceil(totalQty);
      }

      // Bu ürünün doğrudan bileşenlerini kontrol et
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
        const neededQty = totalQty * unitReq * scrapMultiplier;

        const currentStock = parseFloat(compItem.mevcutStok || 0);

        // Bileşen yeterli mi?
        if (currentStock < neededQty) {
          allComponentsReady = false;
          const isSemiOrFinished = ['Yari_Mamul', 'Yarı_Mamul', 'Mamul'].includes(compItem.kategori);
          blockers.push({
            stockId: compId,
            stockCode: compItem.stokKodu,
            name: compItem.ad,
            category: compItem.kategori,
            needed: parseFloat(neededQty.toFixed(2)),
            available: currentStock,
            shortage: parseFloat((neededQty - currentStock).toFixed(2)),
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

      suggestions.push({
        stockId: stokId,
        stockCode: item.stokKodu,
        name: item.ad,
        category: item.kategori,
        quantity: roundedQty,
        unit: item.birim || 'Adet',
        status: allComponentsReady ? 'Active' : 'Passive',
        statusLabel: allComponentsReady
          ? '🟢 Bileşenler Hazır — İş Emri Açılabilir'
          : '🟡 Beklemede — Alt Bileşen Eksik',
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
        if (item.status !== 'Active') continue; // Sadece aktif iş emri önerilerini oluştur

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
    const WORK_CENTERS = [
      { name: 'İstasyon-1 (Kesim & Büküm)', dailyCapacityHours: 16 },
      { name: 'İstasyon-2 (Kaynak & Sac İşleme)', dailyCapacityHours: 16 },
      { name: 'İstasyon-3 (CNC & Talaşlı İmalat)', dailyCapacityHours: 24 },
      { name: 'İstasyon-4 (Boya & Kaplama)', dailyCapacityHours: 16 },
      { name: 'İstasyon-5 (Montaj & Test)', dailyCapacityHours: 16 },
      { name: 'İstasyon-6 (Paketleme & Sevkiyat)', dailyCapacityHours: 16 }
    ];

    const activeOrders = await UretimEmri.findAll({
      where: { durum: { [Op.in]: ['Planned', 'Approved', 'In_Production'] } }
    });

    const report = WORK_CENTERS.map(wc => {
      const stationOrders = activeOrders.filter(o => o.isMerkezi === wc.name);
      const allocatedHours = stationOrders.reduce((sum, o) => {
        const remainingQty = Math.max(0, parseFloat(o.planlananMiktar) - parseFloat(o.tamamlananMiktar));
        const estHours = parseFloat(o.tahminiSaat || 0);
        return sum + (remainingQty * (estHours / (parseFloat(o.planlananMiktar) || 1)));
      }, 0);

      const loadPercentage = Math.min(100, Math.round((allocatedHours / (wc.dailyCapacityHours * 5)) * 100));
      const isBottleneck = loadPercentage > 85;

      return {
        workCenterName: wc.name,
        dailyCapacityHours: wc.dailyCapacityHours,
        horizonCapacityHours: wc.dailyCapacityHours * 5,
        allocatedHours: parseFloat(allocatedHours.toFixed(1)),
        availableHours: Math.max(0, parseFloat(((wc.dailyCapacityHours * 5) - allocatedHours).toFixed(1))),
        loadPercentage,
        activeOrdersCount: stationOrders.length,
        isBottleneck
      };
    });

    return report;
  }
}

module.exports = new MRPService();
