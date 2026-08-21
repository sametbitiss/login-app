const { UretimEmri, StokKarti, UrunRecetesi, RotaOperasyon, Kullanici, StokHareketi, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class ProductionRepository {
  async generateWorkOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `URETIM-${year}-`;
    const lastOrder = await UretimEmri.findOne({
      where: { isEmriNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return `${prefix}0001`;

    const lastNo = lastOrder.isEmriNo.replace(prefix, '');
    const nextSeq = parseInt(lastNo, 10) + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async generateRecipeNo() {
    const year = new Date().getFullYear();
    const prefix = `REC-${year}-`;
    const allRecipes = await UrunRecetesi.findAll({
      attributes: ['receteKodu']
    });

    let maxSeq = 0;
    allRecipes.forEach(r => {
      if (r.receteKodu && r.receteKodu.startsWith(prefix)) {
        const numPart = parseInt(r.receteKodu.replace(prefix, ''), 10);
        if (!isNaN(numPart) && numPart > maxSeq) {
          maxSeq = numPart;
        }
      }
    });

    const nextSeq = maxSeq + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async findAll(filters = {}) {
    const where = {};
    if (filters.status) where.durum = filters.status;
    if (filters.priority) where.oncelik = filters.priority;
    if (filters.workCenter) where.isMerkezi = filters.workCenter;

    if (filters.search) {
      where[Op.or] = [
        { isEmriNo: { [Op.iLike]: `%${filters.search}%` } },
        { uretimBasligi: { [Op.iLike]: `%${filters.search}%` } },
        { isMerkezi: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    return await UretimEmri.findAll({
      where,
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim', 'mevcutStok'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await UretimEmri.findByPk(id, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: StokKarti, as: 'stokKarti' }
      ]
    });
  }

  async create(orderData, currentUser = null, ipAddress = null) {
    const cleanData = {
      isEmriNo: orderData.isEmriNo || orderData.workOrderNo,
      uretimBasligi: orderData.uretimBasligi || orderData.productionTitle,
      stokId: orderData.stokId || orderData.stockItemId,
      planlananMiktar: orderData.planlananMiktar !== undefined ? orderData.planlananMiktar : orderData.plannedQuantity,
      tamamlananMiktar: orderData.tamamlananMiktar !== undefined ? orderData.tamamlananMiktar : (orderData.completedQuantity || 0),
      fireMiktari: orderData.fireMiktari !== undefined ? orderData.fireMiktari : (orderData.scrapQuantity || 0),
      birim: orderData.birim || orderData.unit || 'Adet',
      durum: orderData.durum || orderData.status || 'Planned',
      oncelik: orderData.oncelik || orderData.priority || 'Normal',
      isMerkezi: orderData.isMerkezi || orderData.workCenter || 'İstasyon-1 (Genel Montaj)',
      planlananBaslangicTarihi: orderData.planlananBaslangicTarihi || orderData.plannedStartDate,
      planlananBitisTarihi: orderData.planlananBitisTarihi || orderData.plannedEndDate,
      gerceklesenBaslangicTarihi: orderData.gerceklesenBaslangicTarihi || orderData.actualStartDate,
      gerceklesenBitisTarihi: orderData.gerceklesenBitisTarihi || orderData.actualEndDate,
      tahminiSaat: orderData.tahminiSaat !== undefined ? orderData.tahminiSaat : orderData.estimatedHours,
      gerceklesenSaat: orderData.gerceklesenSaat !== undefined ? orderData.gerceklesenSaat : orderData.actualHours,
      receteNotlari: orderData.receteNotlari || orderData.bomNotes,
      uretimYonetici: orderData.uretimYonetici || orderData.productionManager,
      notlar: orderData.notlar || orderData.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    if (!cleanData.isEmriNo) {
      cleanData.isEmriNo = await this.generateWorkOrderNo();
    }

    const newOrder = await UretimEmri.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'UretimEmri',
      varlikId: newOrder.id,
      detaylar: { isEmriNo: newOrder.isEmriNo, uretimBasligi: newOrder.uretimBasligi, planlananMiktar: newOrder.planlananMiktar },
      ipAdresi: ipAddress
    });

    return newOrder;
  }

  async updateStatus(id, newStatus, currentUser = null, ipAddress = null) {
    const order = await UretimEmri.findByPk(id);
    if (!order) return null;

    const oldStatus = order.durum;
    order.durum = newStatus;

    if (newStatus === 'In_Production' && !order.gerceklesenBaslangicTarihi) {
      order.gerceklesenBaslangicTarihi = new Date();
    }

    if (newStatus === 'Completed' && oldStatus !== 'Completed') {
      order.gerceklesenBitisTarihi = new Date();
      if (!order.tamamlananMiktar || parseFloat(order.tamamlananMiktar) === 0) {
        order.tamamlananMiktar = order.planlananMiktar;
      }

      const stockItem = await StokKarti.findByPk(order.stokId);
      if (stockItem) {
        const qtyToAdd = parseFloat(order.tamamlananMiktar || order.planlananMiktar) || 1;
        const previousStock = parseFloat(stockItem.mevcutStok) || 0;
        stockItem.mevcutStok = previousStock + qtyToAdd;
        await stockItem.save();

        await logService.logCrud({
          kullaniciId: currentUser ? currentUser.id : null,
          kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
          islem: 'STOCK_INCREMENT_PRODUCTION',
          varlik: 'StokKarti',
          varlikId: stockItem.id,
          detaylar: {
            isEmriNo: order.isEmriNo,
            ad: stockItem.ad,
            previousStock,
            addedQuantity: qtyToAdd,
            newStock: stockItem.mevcutStok
          },
          ipAdresi: ipAddress
        });

        const boms = await UrunRecetesi.findAll({ where: { mamulStokId: order.stokId } });
        for (const bom of boms) {
          const compItem = await StokKarti.findByPk(bom.bilesenStokId);
          if (compItem) {
            const reqQty = (qtyToAdd * parseFloat(bom.gerekliMiktar)) * (1 + (parseFloat(bom.fireOrani || 0) / 100));
            const compPrevStock = parseFloat(compItem.mevcutStok) || 0;
            compItem.mevcutStok = Math.max(0, compPrevStock - reqQty);
            await compItem.save();

            await StokHareketi.create({
              hareketNo: `SH-${Date.now().toString().slice(-6)}`,
              stokId: compItem.id,
              cikisDepoId: 1,
              hareketTuru: 'Outbound',
              miktar: reqQty,
              birimFiyat: compItem.alisFiyati || 0,
              referansNo: order.isEmriNo,
              notlar: `[Üretim Sarfı] ${order.isEmriNo} üretimi için reçeteli hammadde stoktan düşüldü.`,
              yapanKullaniciId: currentUser ? currentUser.id : null
            });
          }
        }
      }
    }

    await order.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'UretimEmri',
      varlikId: order.id,
      detaylar: { field: 'durum', oldStatus, newStatus },
      ipAdresi: ipAddress
    });

    return order;
  }

  // --- BOM (BILL OF MATERIALS) METHODS ---
  async findAllBOM() {
    return await UrunRecetesi.findAll({
      include: [
        { model: StokKarti, as: 'mamulUrun', attributes: ['id', 'stokKodu', 'ad', 'birim', 'kategori', 'mevcutStok'] },
        { model: StokKarti, as: 'bilesenUrun', attributes: ['id', 'stokKodu', 'ad', 'birim', 'mevcutStok', 'alisFiyati', 'paraBirimi', 'kategori'] },
        { model: StokKarti, as: 'alternatifBilesenUrun', attributes: ['id', 'stokKodu', 'ad', 'birim'] }
      ],
      order: [['mamulStokId', 'ASC'], ['seviye', 'ASC'], ['id', 'ASC']]
    });
  }

  async findAllBOMGroupedByProduct() {
    const targetProducts = await StokKarti.findAll({
      where: {
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] }
      },
      order: [['kategori', 'ASC'], ['ad', 'ASC']]
    });

    const allBOMItems = await this.findAllBOM();

    const bomMap = {};
    allBOMItems.forEach(item => {
      if (!bomMap[item.mamulStokId]) {
        bomMap[item.mamulStokId] = [];
      }
      bomMap[item.mamulStokId].push(item);
    });

    const productBOMList = targetProducts.map(product => {
      const items = bomMap[product.id] || [];
      const hasBOM = items.length > 0;
      const version = hasBOM ? items[0].versiyon : 'Rev.01';
      const baseQuantity = hasBOM ? parseFloat(items[0].bazMiktar || 1.0) : 1.0;

      let totalUnitCost = 0;
      items.forEach(b => {
        const compPrice = b.bilesenUrun ? parseFloat(b.bilesenUrun.alisFiyati || 0) : 0;
        const reqQty = parseFloat(b.gerekliMiktar || 0);
        const scrap = parseFloat(b.fireOrani || 0);
        totalUnitCost += reqQty * compPrice * (1 + scrap / 100);
      });

      return {
        product,
        hasBOM,
        version,
        baseQuantity,
        bomItems: items,
        componentCount: items.length,
        totalUnitCost
      };
    });

    return productBOMList;
  }

  async createBOMItem(bomData, currentUser = null, ipAddress = null) {
    const cleanData = {
      receteKodu: bomData.receteKodu || bomData.bomCode,
      mamulStokId: bomData.mamulStokId || bomData.finishedStockItemId,
      bilesenStokId: bomData.bilesenStokId || bomData.componentStockItemId,
      versiyon: bomData.versiyon || bomData.version || 'Rev.01',
      bazMiktar: bomData.bazMiktar !== undefined ? bomData.bazMiktar : bomData.baseQuantity,
      gerekliMiktar: bomData.gerekliMiktar !== undefined ? bomData.gerekliMiktar : bomData.quantityRequired,
      birim: bomData.birim || bomData.unit || 'Adet',
      fireOrani: bomData.fireOrani !== undefined ? bomData.fireOrani : bomData.scrapPercentage,
      seviye: bomData.seviye !== undefined ? bomData.seviye : bomData.level,
      operasyonKodu: bomData.operasyonKodu || bomData.operationCode,
      alternatifBilesenStokId: bomData.alternatifBilesenStokId || bomData.alternativeComponentItemId,
      alternatifNotlar: bomData.alternatifNotlar || bomData.alternativeNotes,
      notlar: bomData.notlar || bomData.notes
    };

    const newBOM = await UrunRecetesi.create(cleanData);
    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'UrunRecetesi',
      varlikId: newBOM.id,
      detaylar: cleanData,
      ipAdresi: ipAddress
    });
    return newBOM;
  }

  async saveProductBOM(mamulStokId, bomHeaderData, currentUser = null, ipAddress = null) {
    const {
      receteKodu,
      version,
      baseQuantity,
      gecerlilikBaslangic,
      gecerlilikBitis,
      durum,
      notlar,
      generalNotes,
      components
    } = bomHeaderData;
    const targetMamulId = parseInt(mamulStokId, 10);

    await UrunRecetesi.destroy({ where: { mamulStokId: targetMamulId } });

    const createdItems = [];
    if (components && components.length > 0) {
      const finalReceteKodu = receteKodu || (await this.generateRecipeNo());
      const finalVersiyon = version ? String(version) : '1';
      const finalDurum = durum || 'Active';
      const finalBaslangic = gecerlilikBaslangic || null;
      const finalBitis = gecerlilikBitis || null;
      const finalGeneralNotes = notlar || generalNotes || null;

      for (const comp of components) {
        const compId = comp.bilesenStokId || comp.componentStockItemId;
        if (!compId) continue;

        const compItem = await StokKarti.findByPk(compId);
        const isSemiFinished = compItem && (compItem.kategori === 'Yari_Mamul' || compItem.kategori === 'Yarı_Mamul');
        const calcLevel = isSemiFinished ? 2 : 3;

        const newBOM = await UrunRecetesi.create({
          receteKodu: finalReceteKodu,
          mamulStokId: targetMamulId,
          bilesenStokId: parseInt(compId, 10),
          versiyon: finalVersiyon,
          bazMiktar: parseFloat(baseQuantity) || 1.0,
          gerekliMiktar: parseFloat(comp.gerekliMiktar || comp.quantityRequired) || 1.0,
          birim: comp.birim || comp.unit || (compItem ? compItem.birim : 'Adet'),
          fireOrani: parseFloat(comp.fireOrani || comp.scrapPercentage) || 0.0,
          seviye: calcLevel,
          operasyonKodu: comp.operasyonKodu || comp.operationCode || null,
          alternatifBilesenStokId: (comp.alternatifBilesenStokId || comp.alternativeComponentItemId) ? parseInt(comp.alternatifBilesenStokId || comp.alternativeComponentItemId, 10) : null,
          alternatifNotlar: comp.alternatifNotlar || comp.alternativeNotes || null,
          notlar: comp.notlar || comp.notes || finalGeneralNotes,
          gecerlilikBaslangic: finalBaslangic,
          gecerlilikBitis: finalBitis,
          durum: finalDurum
        });

        createdItems.push(newBOM);
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'UrunRecetesi',
      varlikId: targetMamulId,
      detaylar: { mamulStokId: targetMamulId, version, baseQuantity, count: createdItems.length },
      ipAdresi: ipAddress
    });

    return createdItems;
  }

  async deleteProductBOM(mamulStokId, currentUser = null, ipAddress = null) {
    const targetMamulId = parseInt(mamulStokId, 10);
    const deletedCount = await UrunRecetesi.destroy({ where: { mamulStokId: targetMamulId } });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'UrunRecetesi',
      varlikId: targetMamulId,
      detaylar: { mamulStokId: targetMamulId, deletedCount },
      ipAdresi: ipAddress
    });

    return deletedCount;
  }

  // --- ROUTING OPERATIONS METHODS ---
  async findAllRoutings() {
    return await RotaOperasyon.findAll({
      include: [
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim', 'kategori', 'mevcutStok'] }
      ],
      order: [['stokId', 'ASC'], ['operasyonSira', 'ASC']]
    });
  }

  async findAllRoutingsGroupedByProduct() {
    const existingBOMs = await UrunRecetesi.findAll({
      attributes: ['mamulStokId'],
      group: ['mamulStokId']
    });
    const finishedItemIds = existingBOMs.map(b => b.mamulStokId);

    const candidateProducts = await StokKarti.findAll({
      where: {
        id: { [Op.in]: finishedItemIds },
        durum: 'Active',
        kategori: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] },
        tedarikYontemi: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['kategori', 'ASC'], ['ad', 'ASC']]
    });

    const allOperations = await this.findAllRoutings();

    const routingMap = {};
    allOperations.forEach(op => {
      if (!routingMap[op.stokId]) {
        routingMap[op.stokId] = [];
      }
      routingMap[op.stokId].push(op);
    });

    return candidateProducts.map(product => {
      const ops = routingMap[product.id] || [];
      const hasRouting = ops.length > 0;
      let totalSetupTime = 0;
      let totalRunTime = 0;
      const workCentersSet = new Set();

      ops.forEach(o => {
        totalSetupTime += parseFloat(o.hazirlikSuresiDakika || 0);
        totalRunTime += parseFloat(o.calismaSuresiDakikaBirim || 0);
        if (o.isMerkezi) workCentersSet.add(o.isMerkezi);
      });

      return {
        product: product.get({ plain: true }),
        hasRouting,
        operations: ops.map(o => o.get({ plain: true })),
        totalOperations: ops.length,
        totalSetupTime,
        totalRunTime,
        workCenters: Array.from(workCentersSet)
      };
    });
  }

  async getMultiLevelProductionPlan(stokId, plannedQuantity = 1) {
    const validStockItemId = parseInt(stokId, 10);
    const mainProduct = await StokKarti.findByPk(validStockItemId);
    if (!mainProduct) return [];

    const planItemsMap = new Map();

    const traverseBOM = async (productId, requiredQty, currentLevel = 1) => {
      const product = await StokKarti.findByPk(productId);
      if (!product) return;

      const bomItems = await UrunRecetesi.findAll({
        where: { mamulStokId: productId },
        include: [{ model: StokKarti, as: 'bilesenUrun' }],
        order: [['seviye', 'ASC'], ['id', 'ASC']]
      });

      const routingOperations = await RotaOperasyon.findAll({
        where: { stokId: productId },
        order: [['operasyonSira', 'ASC']]
      });

      const maxLevel = bomItems.length > 0 ? Math.max(...bomItems.map(b => b.seviye || (currentLevel + 1))) : currentLevel;
      const effectiveLevel = currentLevel === 1 ? 1 : maxLevel;

      if (!planItemsMap.has(productId)) {
        planItemsMap.set(productId, {
          product: product.get({ plain: true }),
          level: effectiveLevel,
          plannedQuantity: parseFloat(requiredQty) || 1,
          bomItems: bomItems.map(b => b.get({ plain: true })),
          routingOperations: routingOperations.map(r => r.get({ plain: true }))
        });
      } else {
        const existing = planItemsMap.get(productId);
        existing.plannedQuantity += (parseFloat(requiredQty) || 1);
        if (effectiveLevel > existing.level) existing.level = effectiveLevel;
      }

      for (const b of bomItems) {
        const comp = b.bilesenUrun;
        if (comp && ['Yarı_Mamul', 'Yari_Mamul'].includes(comp.kategori) && ['Üretim', 'Production'].includes(comp.tedarikYontemi)) {
          const compQty = requiredQty * (parseFloat(b.gerekliMiktar || 1) / parseFloat(b.bazMiktar || 1));
          await traverseBOM(comp.id, compQty, b.seviye || (currentLevel + 1));
        }
      }
    };

    await traverseBOM(validStockItemId, parseFloat(plannedQuantity) || 1, 1);

    const planItems = Array.from(planItemsMap.values());
    planItems.sort((a, b) => b.level - a.level);

    return planItems;
  }

  async saveProductRouting(stokId, operationsArray, currentUser = null, ipAddress = null) {
    const validStockItemId = parseInt(stokId, 10);
    const targetProduct = await StokKarti.findByPk(validStockItemId);
    if (!targetProduct) {
      throw new Error('Geçersiz ürün kimliği.');
    }

    if (!Array.isArray(operationsArray) || operationsArray.length === 0) {
      throw new Error('Lütfen en az bir operasyon adımı ekleyiniz.');
    }

    // Step numbers uniqueness & strict field validations
    const seqSet = new Set();
    for (let i = 0; i < operationsArray.length; i++) {
      const op = operationsArray[i];
      const seq = parseInt(op.operasyonSira || op.operationSeq, 10);
      if (isNaN(seq) || seq <= 0) {
        throw new Error(`Operasyon Adımı #${i + 1}: Adım sırası (operasyon numarası) 0'dan büyük bir tam sayı olmalıdır.`);
      }
      if (seqSet.has(seq)) {
        throw new Error(`Aynı rota içinde mükerrer adım numarası (${seq}) kullanılamaz. Lütfen her adıma benzersiz bir numara veriniz.`);
      }
      seqSet.add(seq);

      const name = (op.operasyonAdi || op.operationName || '').trim();
      if (!name) {
        throw new Error(`Adım ${seq}: Operasyon / İşlem adı zorunludur.`);
      }

      const wc = (op.isMerkezi || op.workCenter || '').trim();
      if (!wc) {
        throw new Error(`Adım ${seq}: Bağlı olduğu İş Merkezi seçimi zorunludur.`);
      }

      const setup = parseFloat(op.hazirlikSuresiDakika !== undefined ? op.hazirlikSuresiDakika : op.setupTimeMinutes);
      if (isNaN(setup) || setup < 0) {
        throw new Error(`Adım ${seq}: Hazırlık süresi negatif olamaz (0 veya daha büyük olmalıdır).`);
      }

      const run = parseFloat(op.calismaSuresiDakikaBirim !== undefined ? op.calismaSuresiDakikaBirim : op.runTimeMinutesPerUnit);
      if (isNaN(run) || run < 0) {
        throw new Error(`Adım ${seq}: İşlem / operasyon süresi negatif olamaz (0 veya daha büyük olmalıdır).`);
      }

      const operators = parseInt(op.operatorSayisi !== undefined ? op.operatorSayisi : op.operatorCount, 10);
      if (isNaN(operators) || operators < 1) {
        throw new Error(`Adım ${seq}: İşçilik / personel ihtiyacı en az 1 kişi olmalıdır (negatif olamaz).`);
      }

      const durum = op.durum || 'Active';
      if (!['Active', 'Inactive'].includes(durum)) {
        throw new Error(`Adım ${seq}: Geçerli bir durum seçilmelidir (Aktif/Pasif).`);
      }
    }

    await RotaOperasyon.destroy({ where: { stokId: validStockItemId } });

    const createdOperations = [];
    for (let i = 0; i < operationsArray.length; i++) {
      const op = operationsArray[i];
      const seq = parseInt(op.operasyonSira || op.operationSeq, 10);
      const code = op.operasyonKodu || op.operationCode || `OPS-${String(seq).padStart(2, '0')}`;
      const name = (op.operasyonAdi || op.operationName || '').trim();
      const wc = (op.isMerkezi || op.workCenter || '').trim();
      const wcId = op.isMerkeziId ? parseInt(op.isMerkeziId, 10) : null;
      const setup = parseFloat(op.hazirlikSuresiDakika !== undefined ? op.hazirlikSuresiDakika : op.setupTimeMinutes) || 0;
      const run = parseFloat(op.calismaSuresiDakikaBirim !== undefined ? op.calismaSuresiDakikaBirim : op.runTimeMinutesPerUnit) || 0;
      const operators = parseInt(op.operatorSayisi !== undefined ? op.operatorSayisi : op.operatorCount, 10) || 1;
      const durum = op.durum || 'Active';
      const inst = op.talimatlar || op.instructions || null;
      let usedComps = null;
      if (Array.isArray(op.kullanilanBilesenler || op.usedComponents)) {
        usedComps = JSON.stringify(op.kullanilanBilesenler || op.usedComponents);
      } else if (typeof (op.kullanilanBilesenler || op.usedComponents) === 'string') {
        usedComps = op.kullanilanBilesenler || op.usedComponents;
      }

      const newOp = await RotaOperasyon.create({
        rotaKodu: `ROT-${targetProduct.stokKodu}-v1`,
        stokId: validStockItemId,
        operasyonSira: seq,
        operasyonKodu: code,
        operasyonAdi: name,
        isMerkeziId: wcId,
        isMerkezi: wc,
        hazirlikSuresiDakika: setup,
        calismaSuresiDakikaBirim: run,
        operatorSayisi: operators,
        durum: durum,
        talimatlar: inst,
        kullanilanBilesenler: usedComps
      });

      createdOperations.push(newOp);
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'RotaOperasyon',
      varlikId: validStockItemId,
      detaylar: { stokId: validStockItemId, count: createdOperations.length },
      ipAdresi: ipAddress
    });

    return createdOperations;
  }

  async deleteProductRouting(stokId, currentUser = null, ipAddress = null) {
    const validStockItemId = parseInt(stokId, 10);
    const deletedCount = await RotaOperasyon.destroy({ where: { stokId: validStockItemId } });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'RotaOperasyon',
      varlikId: validStockItemId,
      detaylar: { stokId: validStockItemId, deletedCount },
      ipAdresi: ipAddress
    });

    return deletedCount;
  }

  async updateMESData(id, mesData, currentUser = null, ipAddress = null) {
    const order = await UretimEmri.findByPk(id);
    if (!order) return null;

    if (mesData.tamamlananMiktar !== undefined || mesData.completedQuantity !== undefined) order.tamamlananMiktar = parseFloat(mesData.tamamlananMiktar !== undefined ? mesData.tamamlananMiktar : mesData.completedQuantity);
    if (mesData.fireMiktari !== undefined || mesData.scrapQuantity !== undefined) order.fireMiktari = parseFloat(mesData.fireMiktari !== undefined ? mesData.fireMiktari : mesData.scrapQuantity);
    if (mesData.gerceklesenSaat !== undefined || mesData.actualHours !== undefined) order.gerceklesenSaat = parseFloat(mesData.gerceklesenSaat !== undefined ? mesData.gerceklesenSaat : mesData.actualHours);
    if (mesData.notlar || mesData.notes) order.notlar = mesData.notlar || mesData.notes;

    await order.save();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE_MES',
      varlik: 'UretimEmri',
      varlikId: order.id,
      detaylar: mesData,
      ipAdresi: ipAddress
    });

    return order;
  }

  async getStats() {
    const totalOrders = await UretimEmri.count();
    const plannedOrders = await UretimEmri.count({ where: { durum: 'Planned' } });
    const inProductionOrders = await UretimEmri.count({ where: { durum: 'In_Production' } });
    const completedOrders = await UretimEmri.count({ where: { durum: 'Completed' } });
    
    const totalPlannedQtyResult = await UretimEmri.sum('planlananMiktar', { where: { durum: { [Op.ne]: 'Cancelled' } } });

    return {
      totalOrders,
      plannedOrders,
      inProductionOrders,
      completedOrders,
      totalPlannedQty: totalPlannedQtyResult || 0
    };
  }
}

module.exports = new ProductionRepository();
