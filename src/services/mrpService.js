const {
  UretimEmri,
  UrunRecetesi,
  StokKarti,
  SatinAlmaTalebi,
  SatisSiparisi,
  RotaOperasyon,
  sequelize
} = require('../../models');
const logService = require('./logService');
const { Op } = require('sequelize');

class MRPService {
  /**
   * Runs the full hierarchical Multi-Level Material Requirements Planning (MRP) engine.
   * - Evaluates active demands from Approved Sales Orders and Planned Production Requisitions.
   * - Recursively explodes BOM trees down to raw materials, factoring in scrap (fire) rates at each level.
   * - Checks real-time stock inventory in the database.
   * - Implements Dependency Branch Gating:
   *     - If all direct child components are available -> Work Order Suggestion (İş Emri Önerisi).
   *     - If child components are missing -> Halts branch, generates Production Requisition Suggestion for the parent and Purchase Requisitions for missing raw materials.
   */
  async runMRP() {
    // 1. Fetch all active stock items and recipes for fast in-memory indexing
    const allStocks = await StokKarti.findAll({
      order: [['ad', 'ASC']]
    });
    const stockMap = new Map();
    allStocks.forEach(s => stockMap.set(s.id, s));

    const allBOMs = await UrunRecetesi.findAll({
      where: { durum: 'Active' },
      include: [{ model: StokKarti, as: 'bilesenUrun' }]
    });

    const bomsByParent = {};
    allBOMs.forEach(b => {
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

    // 2. Fetch active demands: Approved Sales Orders and Planned Production Requests
    const activeSales = await SatisSiparisi.findAll({
      where: {
        durum: { [Op.in]: ['Approved', 'Preparing'] },
        karsilanmaDurumu: { [Op.ne]: 'Delivered' }
      },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });

    const activeReqOrders = await UretimEmri.findAll({
      where: { durum: 'Planned' },
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });

    const openPurchaseReqs = await SatinAlmaTalebi.findAll({
      where: { durum: { [Op.in]: ['Pending', 'Pending_Approval', 'Approved'] } }
    });
    const openReqQtyMap = new Map();
    openPurchaseReqs.forEach(pr => {
      const current = openReqQtyMap.get(pr.stokId) || 0;
      openReqQtyMap.set(pr.stokId, current + parseFloat(pr.talepEdilenMiktar || 0));
    });

    // 3. Normalize demand list
    const demandList = [];

    for (const s of activeSales) {
      let items = [];
      if (s.kalemlerJson) {
        try {
          const parsed = typeof s.kalemlerJson === 'string' ? JSON.parse(s.kalemlerJson) : s.kalemlerJson;
          if (Array.isArray(parsed) && parsed.length > 0) {
            items = parsed.filter(it => it && (it.stokId || it.stockItemId) && parseFloat(it.miktar || it.quantity || 0) > 0);
          }
        } catch (e) { items = []; }
      }

      if (items.length > 0) {
        for (const itemLine of items) {
          const sId = itemLine.stokId || itemLine.stockItemId;
          const qty = parseFloat(itemLine.miktar || itemLine.quantity || 1);
          const st = stockMap.get(sId);
          demandList.push({
            demandId: `SO-${s.id}-${sId}`,
            sourceType: 'SalesOrder',
            sourceNo: s.siparisNo,
            sourceRef: `Satış Siparişi: ${s.siparisNo}`,
            customerName: s.musteriAdi || 'Genel Müşteri',
            stockId: sId,
            productName: st ? st.ad : (itemLine.ad || itemLine.name || `Stok #${sId}`),
            stockCode: st ? st.stokKodu : (itemLine.stokKodu || itemLine.stockCode || '—'),
            quantity: qty,
            unit: st ? st.birim : (itemLine.birim || itemLine.unit || 'Adet'),
            deliveryDate: s.teslimTarihi || s.siparisTarihi,
            priority: s.oncelik || 'Normal'
          });
        }
      } else if (s.stokId && parseFloat(s.miktar || 0) > 0) {
        const st = stockMap.get(s.stokId);
        demandList.push({
          demandId: `SO-${s.id}`,
          sourceType: 'SalesOrder',
          sourceNo: s.siparisNo,
          sourceRef: `Satış Siparişi: ${s.siparisNo}`,
          customerName: s.musteriAdi || 'Genel Müşteri',
          stockId: s.stokId,
          productName: st ? st.ad : (s.stokKarti ? s.stokKarti.ad : `Stok #${s.stokId}`),
          stockCode: st ? st.stokKodu : (s.stokKarti ? s.stokKarti.stokKodu : '—'),
          quantity: parseFloat(s.miktar),
          unit: st ? st.birim : 'Adet',
          deliveryDate: s.teslimTarihi || s.siparisTarihi,
          priority: s.oncelik || 'Normal'
        });
      }
    }

    for (const r of activeReqOrders) {
      const st = stockMap.get(r.stokId);
      demandList.push({
        demandId: `WO-${r.id}`,
        sourceType: 'ProductionRequisition',
        sourceNo: r.isEmriNo,
        sourceRef: `Üretim Talebi: ${r.isEmriNo}`,
        customerName: 'Dahili Üretim Talebi',
        stockId: r.stokId,
        productName: st ? st.ad : (r.stokKarti ? r.stokKarti.ad : `Stok #${r.stokId}`),
        stockCode: st ? st.stokKodu : (r.stokKarti ? r.stokKarti.stokKodu : '—'),
        quantity: parseFloat(r.planlananMiktar || 1),
        unit: r.birim || 'Adet',
        deliveryDate: r.planlananBitisTarihi,
        priority: r.oncelik || 'Normal'
      });
    }

    // 4. Data structures for results
    const globalRequirementsMap = new Map();
    const orderAnalysisTrees = [];
    const workOrderSuggestions = [];
    const productionRequisitionSuggestions = [];
    const purchaseRequisitionSuggestions = [];

    // Helper: Recursive BOM explosion
    const analyzeSubTree = (parentStockId, requiredQty, depth = 1, visited = new Set(), parentPath = '') => {
      if (visited.has(parentStockId) || depth > 10) return null; // Avoid cycle or infinite depth
      const currentVisited = new Set(visited);
      currentVisited.add(parentStockId);

      const parentItem = stockMap.get(parentStockId);
      if (!parentItem) return null;

      const boms = bomsByParent[parentStockId] || [];
      const children = [];
      let directComponentsReady = true;

      for (const bom of boms) {
        const compId = bom.bilesenStokId;
        const compItem = stockMap.get(compId);
        if (!compItem) continue;

        const scrapRate = parseFloat(bom.fireOrani || 0);
        const scrapMultiplier = 1 + (scrapRate / 100);
        const baseQty = parseFloat(bom.bazMiktar || 1) || 1;
        const unitReq = (parseFloat(bom.gerekliMiktar || 1) / baseQty);
        const compGrossReq = requiredQty * unitReq * scrapMultiplier;

        // Global requirement aggregation
        if (!globalRequirementsMap.has(compId)) {
          globalRequirementsMap.set(compId, {
            item: compItem,
            grossRequirement: 0,
            currentStock: parseFloat(compItem.mevcutStok || 0),
            openReqQty: openReqQtyMap.get(compId) || 0,
            unit: compItem.birim || 'Adet',
            references: new Set(),
            procurementMethod: compItem.tedarikYontemi || ((compItem.kategori === 'Mamul' || compItem.kategori === 'Yarı_Mamul' || compItem.kategori === 'Yari_Mamul') ? 'Üretim' : 'Satın Alma')
          });
        }
        const gEntry = globalRequirementsMap.get(compId);
        gEntry.grossRequirement += compGrossReq;
        gEntry.references.add(parentPath ? `${parentPath} ➔ [${compItem.stokKodu}]` : `[${compItem.stokKodu}]`);

        // Recurse child tree
        const childPath = parentPath ? `${parentPath} ➔ ${compItem.stokKodu}` : `${parentItem.stokKodu} ➔ ${compItem.stokKodu}`;
        const childSubTree = analyzeSubTree(compId, compGrossReq, depth + 1, currentVisited, childPath);

        const currentStock = parseFloat(compItem.mevcutStok || 0);
        const isStockSufficient = currentStock >= compGrossReq;
        if (!isStockSufficient) {
          directComponentsReady = false;
        }

        children.push({
          stockId: compId,
          stockCode: compItem.stokKodu,
          name: compItem.ad,
          category: compItem.kategori,
          procurementMethod: compItem.tedarikYontemi || 'Satın Alma',
          unit: compItem.birim,
          unitRecipeQty: parseFloat(unitReq.toFixed(4)),
          scrapRate: scrapRate,
          grossRequiredQty: parseFloat(compGrossReq.toFixed(4)),
          currentStock: currentStock,
          isStockSufficient: isStockSufficient,
          shortageQty: isStockSufficient ? 0 : parseFloat((compGrossReq - currentStock).toFixed(4)),
          subTree: childSubTree
        });
      }

      const routings = routingsByStock[parentStockId] || [];
      const primaryWorkCenter = routings.length > 0 ? (routings[0].isMerkezi || 'İstasyon-1 (Genel Montaj)') : 'İstasyon-1 (Genel Montaj)';
      let estimatedHours = 0;
      if (routings.length > 0) {
        estimatedHours = routings.reduce((sum, r) => {
          const setupMins = parseFloat(r.hazirlikSuresiDakika || 0);
          const unitMins = parseFloat(r.calismaSuresiDakikaBirim || 0);
          return sum + ((setupMins + (unitMins * requiredQty)) / 60);
        }, 0);
      } else {
        estimatedHours = Math.max(1, Math.round(requiredQty * 1.5));
      }

      return {
        stockId: parentStockId,
        stockCode: parentItem.stokKodu,
        name: parentItem.ad,
        category: parentItem.kategori,
        procurementMethod: parentItem.tedarikYontemi || 'Üretim',
        demandedQty: parseFloat(requiredQty.toFixed(4)),
        unit: parentItem.birim || 'Adet',
        hasBOM: boms.length > 0,
        directComponentsReady: boms.length > 0 ? directComponentsReady : true,
        primaryWorkCenter: primaryWorkCenter,
        estimatedHours: parseFloat(estimatedHours.toFixed(1)),
        children: children
      };
    };

    // 5. Analyze each demand and collect recommendations
    for (const demand of demandList) {
      const rootTree = analyzeSubTree(demand.stockId, demand.quantity, 1, new Set(), demand.stockCode);
      orderAnalysisTrees.push({
        demand,
        tree: rootTree
      });
    }

    // Helper: Traverse tree and extract actionable recommendations
    const processedNodeKeys = new Set();

    const collectRecommendations = (node, demand) => {
      if (!node) return;

      const nodeKey = `${demand.sourceNo}-${node.stockId}-${node.demandedQty}`;
      if (processedNodeKeys.has(nodeKey)) return;
      processedNodeKeys.add(nodeKey);

      if (node.procurementMethod === 'Üretim') {
        if (node.directComponentsReady && node.hasBOM) {
          workOrderSuggestions.push({
            demandSource: demand.sourceRef,
            sourceNo: demand.sourceNo,
            customerName: demand.customerName,
            stockId: node.stockId,
            stockCode: node.stockCode,
            name: node.name,
            category: node.category,
            suggestedQty: node.demandedQty,
            unit: node.unit,
            targetWorkCenter: node.primaryWorkCenter,
            estimatedHours: node.estimatedHours,
            deliveryDate: demand.deliveryDate,
            priority: demand.priority,
            status: 'Ready_For_Production',
            statusText: '🟢 Bileşenler Tam - İş Emri Açılabilir',
            notes: `[MRP Önerisi] ${demand.sourceRef} için tüm bileşenler stokta hazır.`
          });
        } else if (!node.directComponentsReady) {
          const missing = (node.children || []).filter(c => !c.isStockSufficient);
          const missingSummary = missing.map(c => `[${c.stockCode}] ${c.name} (-${c.shortageQty} ${c.unit})`).join(', ');
          productionRequisitionSuggestions.push({
            demandSource: demand.sourceRef,
            sourceNo: demand.sourceNo,
            customerName: demand.customerName,
            stockId: node.stockId,
            stockCode: node.stockCode,
            name: node.name,
            category: node.category,
            suggestedQty: node.demandedQty,
            unit: node.unit,
            targetWorkCenter: node.primaryWorkCenter,
            deliveryDate: demand.deliveryDate,
            priority: demand.priority,
            status: 'Gated_Waiting_Components',
            statusText: '🟡 Kanat Durduruldu - Alt Bileşen Eksik',
            missingComponentsSummary: missingSummary,
            notes: `[MRP Kanat Durdurma] Alt bileşen eksikliği nedeniyle iş emri verilemez. Eksikler: ${missingSummary}`
          });
        }
      }

      if (node.children) {
        for (const child of node.children) {
          if (child.subTree) {
            collectRecommendations(child.subTree, demand);
          }
        }
      }
    };

    for (const item of orderAnalysisTrees) {
      collectRecommendations(item.tree, item.demand);
    }

    // 6. Aggregate Purchase Requisitions & flat mrpResults
    const mrpResults = [];

    for (const [compId, data] of globalRequirementsMap.entries()) {
      const stockItem = data.item;
      const currentStock = data.currentStock;
      const openReqQty = data.openReqQty;
      const totalAvailable = currentStock + openReqQty;
      const grossReq = data.grossRequirement;
      const netRequirement = Math.max(0, grossReq - totalAvailable);

      let urgency = 'Normal';
      if (currentStock <= 0 && netRequirement > 0) {
        urgency = 'Critical';
      } else if (netRequirement > (currentStock * 0.5)) {
        urgency = 'High';
      }

      const referencesText = Array.from(data.references).join(', ');

      const mrpRow = {
        stockItemId: compId,
        stockId: compId,
        stockCode: stockItem.stokKodu,
        stokKodu: stockItem.stokKodu,
        name: stockItem.ad,
        ad: stockItem.ad,
        category: stockItem.kategori,
        kategori: stockItem.kategori,
        procurementMethod: data.procurementMethod,
        tedarikYontemi: data.procurementMethod,
        unit: data.unit,
        birim: data.unit,
        currentStock: parseFloat(currentStock.toFixed(2)),
        openReqQty: parseFloat(openReqQty.toFixed(2)),
        grossRequirement: parseFloat(grossReq.toFixed(2)),
        totalAvailable: parseFloat(totalAvailable.toFixed(2)),
        netRequirement: parseFloat(netRequirement.toFixed(2)),
        urgency: urgency,
        references: referencesText,
        suggestedSupplier: stockItem.tedarikci || 'Ana Tedarikçi'
      };

      mrpResults.push(mrpRow);

      if (data.procurementMethod === 'Satın Alma' && netRequirement > 0) {
        purchaseRequisitionSuggestions.push({
          stockId: compId,
          stockCode: stockItem.stokKodu,
          name: stockItem.ad,
          category: stockItem.kategori,
          unit: data.unit,
          currentStock: parseFloat(currentStock.toFixed(2)),
          openReqQty: parseFloat(openReqQty.toFixed(2)),
          grossRequirement: parseFloat(grossReq.toFixed(2)),
          netShortage: parseFloat(netRequirement.toFixed(2)),
          suggestedSupplier: stockItem.tedarikci || 'Ana Tedarikçi',
          urgency: urgency,
          references: referencesText
        });
      }
    }

    // 7. Calculate KPI summary
    const kpiSummary = {
      totalDemandsCount: demandList.length,
      readyWorkOrdersCount: workOrderSuggestions.length,
      gatedProductionReqsCount: productionRequisitionSuggestions.length,
      purchaseReqsCount: purchaseRequisitionSuggestions.length,
      totalNetShortageItemsCount: mrpResults.filter(i => i.netRequirement > 0).length
    };

    return {
      demandsAnalyzed: demandList,
      orderAnalysisTrees,
      workOrderSuggestions,
      productionRequisitionSuggestions,
      purchaseRequisitionSuggestions,
      mrpResults,
      kpiSummary
    };
  }

  /**
   * Executes recommendations generated by MRP:
   * Creates Purchase Requisitions in SatinAlmaTalebi and/or Work Orders in UretimEmri.
   */
  async executeMRPRecommendations(options = {}, currentUser = null, ipAddress = null) {
    const { createPurchaseReqs = true, createWorkOrders = false, selectedStockIds = null } = options;
    const mrpData = await this.runMRP();

    const createdRecords = {
      purchaseRequisitions: [],
      workOrders: []
    };

    // 1. Generate Purchase Requisitions
    if (createPurchaseReqs && mrpData.purchaseRequisitionSuggestions.length > 0) {
      for (const item of mrpData.purchaseRequisitionSuggestions) {
        if (selectedStockIds && !selectedStockIds.includes(item.stockId)) continue;

        const nextReqNo = `TAL-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;
        const req = await SatinAlmaTalebi.create({
          talepNo: nextReqNo,
          kaynakModul: 'Production',
          talepEdenAdi: currentUser ? (currentUser.ad ? `${currentUser.ad} ${currentUser.soyad || ''}` : currentUser.kullaniciAdi) : 'MRP Motoru',
          stokId: item.stockId,
          talepEdilenMiktar: item.netShortage,
          birim: item.unit,
          aciliyet: item.urgency === 'Critical' ? 'Urgent' : (item.urgency === 'High' ? 'High' : 'Normal'),
          durum: 'Approved',
          notlar: `[Otomatik MRP] Net Eksik İhtiyaç: ${item.netShortage} ${item.unit} (Brüt: ${item.grossRequirement}, Stok: ${item.currentStock}). Kaynak: ${item.references}`,
          olusturanId: currentUser ? currentUser.id : null
        });

        await logService.logCrud({
          kullaniciId: currentUser ? currentUser.id : null,
          kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'MRP Engine',
          islem: 'CREATE',
          varlik: 'SatinAlmaTalebi',
          varlikId: req.id,
          detaylar: { talepNo: req.talepNo, stokId: req.stokId, miktar: req.talepEdilenMiktar, kaynak: 'MRP_EXECUTION' },
          ipAdresi: ipAddress
        });

        createdRecords.purchaseRequisitions.push(req);
      }
    }

    // 2. Generate Work Orders for ready suggestions if requested
    if (createWorkOrders && mrpData.workOrderSuggestions.length > 0) {
      const year = new Date().getFullYear();
      for (const item of mrpData.workOrderSuggestions) {
        if (selectedStockIds && !selectedStockIds.includes(item.stockId)) continue;

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
        let deliveryDateStr = item.deliveryDate ? new Date(item.deliveryDate).toISOString().split('T')[0] : null;
        if (!deliveryDateStr) {
          const d = new Date();
          d.setDate(d.getDate() + 7);
          deliveryDateStr = d.toISOString().split('T')[0];
        }

        const wo = await UretimEmri.create({
          isEmriNo: workOrderNo,
          uretimBasligi: `🏭 [MRP İş Emri] ${item.name} (${item.suggestedQty} ${item.unit})`,
          stokId: item.stockId,
          planlananMiktar: item.suggestedQty,
          tamamlananMiktar: 0,
          fireMiktari: 0,
          birim: item.unit,
          durum: 'Approved',
          oncelik: item.priority || 'Normal',
          isMerkezi: item.targetWorkCenter || 'İstasyon-1 (Genel Montaj)',
          planlananBaslangicTarihi: todayStr,
          planlananBitisTarihi: deliveryDateStr,
          tahminiSaat: item.estimatedHours || 4,
          receteNotlari: `Kaynak: ${item.demandSource}`,
          notlar: `[MRP İş Emri Oluşturma] ${item.demandSource} için bileşenleri tam olan ürünün iş emridir.`,
          olusturanId: currentUser ? currentUser.id : null
        });

        await logService.logCrud({
          kullaniciId: currentUser ? currentUser.id : null,
          kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'MRP Engine',
          islem: 'CREATE',
          varlik: 'UretimEmri',
          varlikId: wo.id,
          detaylar: { isEmriNo: wo.isEmriNo, stokId: wo.stokId, miktar: wo.planlananMiktar, kaynak: 'MRP_EXECUTION' },
          ipAdresi: ipAddress
        });

        createdRecords.workOrders.push(wo);
      }
    }

    return createdRecords;
  }

  // Preserved backwards compatibility method
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
