const stockRepository = require('../repositories/stockRepository');
const stockValuationService = require('../services/stockValuationService');
const purchaseRepository = require('../repositories/purchaseRepository');
const purchaseService = require('../services/purchaseService');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const salesRepository = require('../repositories/saleRepository');
const requisitionRepository = require('../repositories/requisitionRepository');
const asyncHandler = require('../utils/asyncHandler');
const { NotFoundError, ValidationError } = require('../utils/appError');
const { ALL_ROLES } = require('../middleware/rbacMiddleware');
const { MalKabul, SatinAlmaSiparisi, StokKarti, StokHareketi, Tedarikci, Depo } = require('../../models');

const CATEGORIES = [
  { value: 'Hammadde', label: 'Hammadde' },
  { value: 'Yari_Mamul', label: 'Yarı Mamul' },
  { value: 'Mamul', label: 'Mamul' }
];

class StockController {
  // 0. STOCK ANALYTICS DASHBOARD
  showAnalytics = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();
    const stats = await stockRepository.getStats();
    const warehouses = await stockRepository.findAllWarehouses();
    const lowStockItems = await stockRepository.getLowStockAlerts();
    const valuationReport = await stockValuationService.calculateValuation();
    const movements = await stockRepository.findAllMovements();

    res.render('stock/analytics', {
      user: req.user,
      stockItems,
      stats,
      warehouses,
      lowStockItems,
      valuationReport,
      movements: movements.slice(0, 5),
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'analytics'
    });
  });

  // 1. STOCK ITEMS MANAGEMENT
  listItems = asyncHandler(async (req, res) => {
    const { search, category, status } = req.query;
    const stockItems = await stockRepository.findAll({ search, category, status });
    const stats = await stockRepository.getStats();

    let successMsg = null;
    if (req.query.success === 'purchase') {
      successMsg = '🛒 Satın Alma Talebi başarıyla oluşturuldu ve Satın Alma Modülüne (Talepler Kartına) iletildi.';
    } else if (req.query.success === 'production') {
      successMsg = '⚙️ Üretim Talebi başarıyla oluşturuldu ve Üretim Modülüne (Talepler Kartına) iletildi.';
    }

    res.render('stock/list', {
      user: req.user,
      stockItems,
      stats,
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'items',
      filterSearch: search || '',
      filterCategory: category || '',
      filterStatus: status || '',
      successMsg
    });
  });

  renderAdd = asyncHandler(async (req, res) => {
    const nextStockCode = await stockRepository.getNextStockCode();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/add', {
      user: req.user,
      nextStockCode,
      nextCode: nextStockCode,
      warehouses,
      CATEGORIES,
      ALL_ROLES,
      activeSubTab: 'items',
      formData: {},
      error: null
    });
  });

  addItem = asyncHandler(async (req, res) => {
    try {
      const nextStockCode = await stockRepository.getNextStockCode();
      let category = req.body.category || req.body.kategori || 'Hammadde';
      if (category === 'Yarı_Mamul') category = 'Yari_Mamul';

      const barkod = (req.body.barkod || req.body.barcode || '').trim() || null;
      const marka = (req.body.marka || req.body.brand || '').trim() || null;
      const model = (req.body.model || '').trim() || null;
      const aciklama = (req.body.aciklama || req.body.description || '').trim() || null;
      const depoLokasyonu = (req.body.depoLokasyonu || req.body.warehouseLocation || '').trim() || null;
      const tedarikci = (req.body.tedarikci || req.body.supplier || '').trim() || null;
      const notlar = (req.body.notlar || req.body.notes || '').trim() || null;

      let procurementMethod = req.body.tedarikYontemi || req.body.procurementMethod || 'Satın Alma';
      if (category === 'Mamul') {
        procurementMethod = 'Üretim';
      } else if (category === 'Hammadde' || category === 'Ticari_Mal' || category === 'Ticari Mal') {
        procurementMethod = 'Satın Alma';
      }

      await stockRepository.create({
        stokKodu: nextStockCode,
        ad: req.body.ad || req.body.name,
        kategori: category,
        barkod,
        marka,
        model,
        aciklama,
        depoLokasyonu,
        tedarikci,
        notlar,
        birim: req.body.birim || req.body.unit || 'Adet',
        tedarikYontemi: procurementMethod,
        durum: req.body.durum || req.body.status || 'Active',
        mevcutStok: parseFloat(req.body.mevcutStok || req.body.currentStock) || 0,
        asgariStok: parseFloat(req.body.asgariStok || req.body.minStock) || 0,
        azamiStok: parseFloat(req.body.azamiStok || req.body.maxStock) || 0,
        alisFiyati: parseFloat(req.body.alisFiyati || req.body.purchasePrice) || 0,
        satisFiyati: parseFloat(req.body.satisFiyati || req.body.salePrice) || 0,
        paraBirimi: req.body.paraBirimi || req.body.currency || 'TRY',
        kdvOrani: parseFloat(req.body.kdvOrani || req.body.taxRate) || 20
      }, req.user, req.ip);

      res.redirect('/stock');
    } catch (err) {
      const nextStockCode = await stockRepository.getNextStockCode();
      const warehouses = await stockRepository.findAllWarehouses();

      let friendlyError = err.message;
      if (err.name === 'SequelizeUniqueConstraintError' || err.name === 'SequelizeValidationError') {
        if (err.errors && err.errors.length > 0) {
          friendlyError = err.errors.map(e => {
            if (e.path === 'stokKodu' || e.path === 'stockCode') return 'Bu stok kodu zaten başka bir malzemede kullanılıyor.';
            if (e.path === 'barkod' || e.path === 'barcode') return 'Bu barkod numarası zaten başka bir malzemede kullanılıyor.';
            return e.message;
          }).join(' | ');
        } else {
          friendlyError = 'Girdiğiniz stok koda veya barkod numarası zaten kullanılmaktadır.';
        }
      }

      res.render('stock/add', {
        user: req.user,
        nextStockCode,
        nextCode: nextStockCode,
        warehouses,
        CATEGORIES,
        ALL_ROLES,
        activeSubTab: 'items',
        formData: req.body,
        error: friendlyError || 'Stok kartı eklenirken bir hata oluştu.'
      });
    }
  });

  getItemDetail = asyncHandler(async (req, res) => {
    const item = await stockRepository.findById(req.params.id);
    if (!item) throw new NotFoundError('Stok kalemi bulunamadı.');

    const warehouses = await stockRepository.findAllWarehouses();
    const suppliers = await Tedarikci.findAll({ where: { durum: 'Active' }, order: [['firmaAdi', 'ASC']] });

    res.render('stock/item_detail', {
      user: req.user,
      item,
      warehouses,
      suppliers,
      CATEGORIES,
      activeSubTab: 'items',
      successMsg: req.query.success === 'updated' ? 'Stok kartı bilgileri başarıyla güncellendi!' : null,
      errorMsg: req.query.error || null
    });
  });

  updateItem = asyncHandler(async (req, res) => {
    const item = await stockRepository.findById(req.params.id);
    if (!item) throw new NotFoundError('Stok kalemi bulunamadı.');

    try {
      await stockRepository.update(item.id, {
        tedarikYontemi: req.body.tedarikYontemi || req.body.procurementMethod || item.tedarikYontemi,
        durum: req.body.durum || req.body.status || item.durum,
        asgariStok: (req.body.asgariStok !== undefined && req.body.asgariStok !== '') ? parseFloat(req.body.asgariStok) : (req.body.minStock !== undefined && req.body.minStock !== '' ? parseFloat(req.body.minStock) : 0),
        azamiStok: (req.body.azamiStok !== undefined && req.body.azamiStok !== '') ? parseFloat(req.body.azamiStok) : (req.body.maxStock !== undefined && req.body.maxStock !== '' ? parseFloat(req.body.maxStock) : null),
        alisFiyati: (req.body.alisFiyati !== undefined && req.body.alisFiyati !== '') ? parseFloat(req.body.alisFiyati) : (req.body.purchasePrice !== undefined && req.body.purchasePrice !== '' ? parseFloat(req.body.purchasePrice) : 0),
        satisFiyati: (req.body.satisFiyati !== undefined && req.body.satisFiyati !== '') ? parseFloat(req.body.satisFiyati) : (req.body.salePrice !== undefined && req.body.salePrice !== '' ? parseFloat(req.body.salePrice) : 0),
        paraBirimi: req.body.paraBirimi || req.body.currency || item.paraBirimi,
        kdvOrani: (req.body.kdvOrani !== undefined && req.body.kdvOrani !== '') ? parseFloat(req.body.kdvOrani) : (req.body.taxRate !== undefined && req.body.taxRate !== '' ? parseFloat(req.body.taxRate) : item.kdvOrani),
        depoLokasyonu: req.body.depoLokasyonu || req.body.warehouseLocation ? (req.body.depoLokasyonu || req.body.warehouseLocation).trim() : null,
        tedarikci: req.body.tedarikci || req.body.supplier ? (req.body.tedarikci || req.body.supplier).trim() : null,
        marka: req.body.marka || req.body.brand ? (req.body.marka || req.body.brand).trim() : null,
        model: req.body.model ? req.body.model.trim() : null,
        notlar: req.body.notlar || req.body.notes ? (req.body.notlar || req.body.notes).trim() : null
      }, req.user, req.ip);

      res.redirect(`/stock/items/${item.id}/detail?success=updated`);
    } catch (err) {
      let friendlyError = err.message;
      if (err.name === 'SequelizeUniqueConstraintError' || err.name === 'SequelizeValidationError') {
        if (err.errors && err.errors.length > 0) {
          friendlyError = err.errors.map(e => e.message).join(' | ');
        }
      }
      res.redirect(`/stock/items/${item.id}/detail?error=` + encodeURIComponent(friendlyError));
    }
  });

  // 2. MULTI-WAREHOUSE & LOCATIONS
  listWarehouses = asyncHandler(async (req, res) => {
    const warehouses = await stockRepository.findAllWarehouses();
    const allReceipts = await MalKabul.findAll({
      include: [
        { model: SatinAlmaSiparisi, as: 'satinAlmaSiparisi' },
        { model: Tedarikci, as: 'tedarikci' },
        { model: StokKarti, as: 'stokKarti' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const warehouseData = warehouses.map(wh => {
      const whPlain = wh.toJSON();

      const receiptsForWh = allReceipts.filter(gr => {
        const whLoc = gr.depoLokasyonu || gr.warehouseLocation;
        if (!whLoc) {
          return whPlain.id === 1 || whPlain.tur === 'Hammadde' || whPlain.ad.includes('Ana Hammadde');
        }
        const locClean = whLoc.replace(/&amp;/g, '&').trim().toLowerCase();
        const nameClean = whPlain.ad.replace(/&amp;/g, '&').trim().toLowerCase();
        const codeClean = whPlain.depoKodu.replace(/&amp;/g, '&').trim().toLowerCase();

        return locClean === nameClean || locClean === codeClean || nameClean.includes(locClean) || locClean.includes(nameClean);
      });

      let receiptLogs = [];
      let productMap = {};

      receiptsForWh.forEach(gr => {
        let items = [];
        const kalData = gr.kalemlerVerisi || gr.itemsData;
        if (kalData) {
          try { items = typeof kalData === 'string' ? JSON.parse(kalData) : kalData; } catch(e) { items = []; }
        }
        if (!Array.isArray(items) || items.length === 0) {
          items = [{
            productName: gr.stokKarti ? gr.stokKarti.ad : 'Ürün Kalemi',
            stockCode: gr.stokKarti ? gr.stokKarti.stokKodu : '-',
            currentReceivedQuantity: gr.kabulEdilenMiktar || gr.teslimAlinanMiktar,
            unit: gr.stokKarti ? gr.stokKarti.birim : 'Adet'
          }];
        }

        items.forEach(it => {
          const qty = parseFloat(it.currentReceivedQuantity || it.teslimAlinanMiktar || it.kabulEdilenMiktar || it.receivedQuantity || 0);
          if (qty > 0) {
            const pName = it.productName || it.ad || (gr.stokKarti ? gr.stokKarti.ad : 'Malzeme');
            const sCode = it.stockCode || it.stokKodu || (gr.stokKarti ? gr.stokKarti.stokKodu : '-');
            const unit = it.unit || it.birim || (gr.stokKarti ? gr.stokKarti.birim : 'Adet');
            const receiptDate = gr.kabulTarihi ? new Date(gr.kabulTarihi).toLocaleDateString('tr-TR') : new Date(gr.createdAt).toLocaleDateString('tr-TR');

            receiptLogs.push({
              grnNo: gr.kabulNo || gr.grnNo,
              orderNo: gr.satinAlmaSiparisi ? gr.satinAlmaSiparisi.siparisNo : '—',
              supplierName: gr.tedarikci ? gr.tedarikci.firmaAdi : (gr.satinAlmaSiparisi ? gr.satinAlmaSiparisi.tedarikciAdi : '—'),
              deliveryNoteNo: gr.irsaliyeNo || '—',
              receiptDate: receiptDate,
              productName: pName,
              stockCode: sCode,
              quantity: qty,
              unit: unit
            });

            const key = sCode !== '-' ? sCode : pName;
            if (!productMap[key]) {
              productMap[key] = {
                stockCode: sCode,
                name: pName,
                totalQuantity: 0,
                unit: unit,
                lastReceiptDate: receiptDate
              };
            }
            productMap[key].totalQuantity += qty;
          }
        });
      });

      let jsonItems = [];
      const whKalemler = whPlain.kalemlerJson || whPlain.itemsJson;
      if (whKalemler) {
        try { jsonItems = typeof whKalemler === 'string' ? JSON.parse(whKalemler) : whKalemler; } catch(e) { jsonItems = []; }
      }
      if (Array.isArray(jsonItems)) {
        jsonItems.forEach(ji => {
          const key = ji.stokKodu || ji.stockCode || ji.ad || ji.name;
          if (key) {
            if (!productMap[key]) {
              productMap[key] = {
                stockCode: ji.stokKodu || ji.stockCode || '-',
                name: ji.ad || ji.name || 'Malzeme',
                totalQuantity: parseFloat(ji.miktar || ji.quantity) || 0,
                unit: ji.birim || ji.unit || 'Adet',
                lastReceiptDate: ji.lastUpdated ? new Date(ji.lastUpdated).toLocaleDateString('tr-TR') : '—'
              };
            } else {
              productMap[key].totalQuantity = Math.max(productMap[key].totalQuantity, parseFloat(ji.miktar || ji.quantity) || 0);
            }
          }
        });
      }

      whPlain.productSummary = Object.values(productMap);
      whPlain.receiptLogs = receiptLogs;

      return whPlain;
    });

    res.render('stock/warehouses', {
      user: req.user,
      warehouses: warehouseData,
      ALL_ROLES,
      activeSubTab: 'warehouses'
    });
  });

  addWarehouse = asyncHandler(async (req, res) => {
    const { name, ad, type, tur, city, sehir, address, adres, managerName, sorumluAdi } = req.body;
    const targetName = ad || name;
    if (!targetName) throw new ValidationError('Depo adı zorunludur.');

    const warehouseCode = `DEP-${Math.floor(100 + Math.random() * 900)}`;
    await stockRepository.createWarehouse({
      depoKodu: warehouseCode,
      ad: targetName,
      tur: tur || type || 'General',
      sehir: sehir || city || 'İstanbul',
      adres: adres || address,
      sorumluAdi: sorumluAdi || managerName
    }, req.user, req.ip);

    res.redirect('/stock/warehouses');
  });

  addLocation = asyncHandler(async (req, res) => {
    const { warehouseId, depoId, aisle, koridor, shelf, raf, bin, goz, capacity, kapasite } = req.body;
    const targetDepoId = depoId || warehouseId;
    const targetKoridor = koridor || aisle;
    const targetRaf = raf || shelf;
    const targetGoz = goz || bin;

    if (!targetDepoId || !targetKoridor || !targetRaf || !targetGoz) {
      throw new ValidationError('Depo, Koridor, Raf ve Göz alanları zorunludur.');
    }

    const locationCode = `LOC-${targetDepoId}-${targetKoridor}-${targetRaf}-${targetGoz}`;
    await stockRepository.createLocation({
      lokasyonKodu: locationCode,
      depoId: targetDepoId,
      koridor: targetKoridor,
      raf: targetRaf,
      goz: targetGoz,
      kapasite: parseInt(kapasite || capacity, 10) || 1000
    }, req.user, req.ip);

    res.redirect('/stock/warehouses');
  });

  // 3. LOT / BATCH & SERIAL NUMBER TRACEABILITY
  listLots = asyncHandler(async (req, res) => {
    const lots = await stockRepository.findAllLots();
    const stockItems = await stockRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/lots', {
      user: req.user,
      lots,
      stockItems,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'lots'
    });
  });

  addLot = asyncHandler(async (req, res) => {
    const { stockItemId, stokId, warehouseId, depoId, lotNumber, partiNo, serialNumber, seriNo, quantity, miktar, productionDate, uretimTarihi, expirationDate, sonKullanmaTarihi, qualityStatus, kaliteDurumu, notes, notlar } = req.body;
    const targetStokId = stokId || stockItemId;
    const targetDepoId = depoId || warehouseId;
    const targetPartiNo = partiNo || lotNumber;

    if (!targetStokId || !targetDepoId || !targetPartiNo) {
      throw new ValidationError('Stok kalemi, depo ve lot numarası zorunludur.');
    }

    await stockRepository.createLot({
      stokId: targetStokId,
      depoId: targetDepoId,
      partiNo: targetPartiNo,
      seriNo: seriNo || serialNumber,
      miktar: parseFloat(miktar || quantity) || 0,
      uretimTarihi: uretimTarihi || productionDate,
      sonKullanmaTarihi: sonKullanmaTarihi || expirationDate,
      kaliteDurumu: kaliteDurumu || qualityStatus || 'Approved',
      notlar: notlar || notes
    }, req.user, req.ip);

    res.redirect('/stock/lots');
  });

  // 4. MOVEMENTS & WAREHOUSE TRANSFERS
  listTransfers = asyncHandler(async (req, res) => {
    const movements = await stockRepository.findAllMovements();
    const stockItems = await stockRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/transfers', {
      user: req.user,
      movements,
      stockItems,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'transfers'
    });
  });

  addTransfer = asyncHandler(async (req, res) => {
    const { stockItemId, stokId, sourceWarehouseId, cikisDepoId, targetWarehouseId, varisDepoId, quantity, miktar, notes, notlar } = req.body;
    const targetStokId = stokId || stockItemId;
    const targetCikisDepoId = cikisDepoId || sourceWarehouseId;
    const targetVarisDepoId = varisDepoId || targetWarehouseId;
    const targetMiktar = miktar || quantity;

    if (!targetStokId || !targetCikisDepoId || !targetVarisDepoId || !targetMiktar) {
      throw new ValidationError('Malzeme, çıkış deposu, hedef depo ve miktar alanları zorunludur.');
    }

    await stockRepository.createTransfer({
      stokId: targetStokId,
      cikisDepoId: targetCikisDepoId,
      varisDepoId: targetVarisDepoId,
      miktar: targetMiktar,
      notlar: notlar || notes
    }, req.user, req.ip);

    res.redirect('/stock/transfers');
  });

  // 5. GOODS RECEIPT (SATIN ALMA MAL KABUL)
  listGoodsReceipt = asyncHandler(async (req, res) => {
    const allOrders = await purchaseRepository.findAll();
    const activeOrders = allOrders.filter(po => po.durum !== 'Received' && po.durum !== 'Cancelled');

    const ordersWithDetails = await Promise.all(activeOrders.map(async (po) => {
      const receivedTotals = await goodsReceiptRepository.getReceivedTotalsForOrder(po.id);
      const pastReceipts = await goodsReceiptRepository.getReceiptsByOrderId(po.id);

      let items = [];
      const kalemJson = po.kalemlerJson || po.itemsJson;
      if (kalemJson) {
        try { items = typeof kalemJson === 'string' ? JSON.parse(kalemJson) : kalemJson; } catch (e) { items = []; }
      }
      if (!items || items.length === 0) {
        items = [{
          stokId: po.stokId,
          stokKodu: po.stokKarti ? po.stokKarti.stokKodu : 'STK-001',
          ad: po.stokKarti ? po.stokKarti.ad : 'Ürün Kalemi',
          miktar: po.miktar,
          birim: po.stokKarti ? po.stokKarti.birim : 'Adet',
          birimFiyat: po.birimFiyat
        }];
      }

      let totalOrderedQty = 0;
      let totalReceivedQty = 0;
      const parsedItems = items.map(it => {
        const sId = parseInt(it.stokId || it.stockItemId, 10);
        const ordered = parseFloat(it.miktar || it.quantity) || 0;
        const rec = receivedTotals[sId] || 0;
        const rem = Math.max(0, ordered - rec);

        totalOrderedQty += ordered;
        totalReceivedQty += rec;

        return {
          ...it,
          orderedQuantity: ordered,
          receivedQuantity: rec,
          remainingQuantity: rem
        };
      });

      return {
        ...po.toJSON ? po.toJSON() : po,
        items: parsedItems,
        totalOrderedQty,
        totalReceivedQty,
        totalRemainingQty: Math.max(0, totalOrderedQty - totalReceivedQty),
        receiptCount: pastReceipts.length
      };
    }));

    const warehouses = await stockRepository.findAllWarehouses();

    let successMsg = null;
    if (req.query.success === 'receipt_created') {
      const grnNo = req.query.grnNo || '';
      successMsg = `✅ Mal kabul ve stok girişi ${grnNo ? '(' + grnNo + ') ' : ''}başarıyla kaydedildi, ilgili ürünlerin stok sayıları güncellendi.`;
    }

    res.render('stock/goods_receipt', {
      user: req.user,
      purchaseOrders: ordersWithDetails,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'goods-receipt',
      successMsg
    });
  });

  renderCreateGoodsReceipt = asyncHandler(async (req, res) => {
    const { orderId } = req.query;
    if (!orderId) throw new ValidationError('Sipariş ID belirtilmelidir.');

    const po = await SatinAlmaSiparisi.findByPk(orderId, {
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: Tedarikci, as: 'tedarikci' }
      ]
    });
    if (!po) throw new NotFoundError('Satın alma siparişi bulunamadı.');
    if (po.durum === 'Pending_Approval') {
      throw new ValidationError('Bu sipariş bütçe limitini aştığı için yönetsel onay beklemektedir (Pending_Approval). Onaylanmadan mal kabul işlemi yapılamaz.');
    }

    const receivedTotals = await goodsReceiptRepository.getReceivedTotalsForOrder(po.id);
    const nextGrnNo = await goodsReceiptRepository.getNextGrnNo();
    const warehouses = await stockRepository.findAllWarehouses();

    let items = [];
    const kalemJson = po.kalemlerJson || po.itemsJson;
    if (kalemJson) {
      try { items = typeof kalemJson === 'string' ? JSON.parse(kalemJson) : kalemJson; } catch (e) { items = []; }
    }
    if (!items || items.length === 0) {
      items = [{
        stokId: po.stokId,
        stokKodu: po.stokKarti ? po.stokKarti.stokKodu : 'STK-001',
        ad: po.stokKarti ? po.stokKarti.ad : 'Ürün Kalemi',
        miktar: po.miktar,
        birim: po.stokKarti ? po.stokKarti.birim : 'Adet',
        birimFiyat: po.birimFiyat
      }];
    }

    const itemsForReceipt = items.map(it => {
      const sId = parseInt(it.stokId || it.stockItemId, 10);
      const ordered = parseFloat(it.miktar || it.quantity) || 0;
      const prevRec = receivedTotals[sId] || 0;
      const remaining = Math.max(0, ordered - prevRec);

      return {
        ...it,
        stokId: sId,
        orderedQuantity: ordered,
        previouslyReceivedQuantity: prevRec,
        remainingQuantity: remaining,
        currentReceivedQuantity: remaining
      };
    });

    res.render('stock/goods_receipt_create', {
      user: req.user,
      order: po,
      nextGrnNo,
      items: itemsForReceipt,
      warehouses,
      error: null
    });
  });

  processGoodsReceipt = asyncHandler(async (req, res) => {
    const {
      purchaseOrderId, satinAlmaSiparisId,
      warehouseLocation, depoLokasyonu,
      deliveryNoteNo, irsaliyeNo,
      deliveryNoteDate, irsaliyeTarihi,
      notes, notlar
    } = req.body;

    const poId = satinAlmaSiparisId || purchaseOrderId;
    const po = await SatinAlmaSiparisi.findByPk(poId, {
      include: [{ model: StokKarti, as: 'stokKarti' }]
    });
    if (!po) throw new NotFoundError('Satın alma siparişi bulunamadı.');
    if (po.durum === 'Pending_Approval') {
      throw new ValidationError('Bu sipariş bütçe limitini aştığı için yönetsel onay beklemektedir (Pending_Approval). Onaylanmadan mal kabul işlemi yapılamaz.');
    }

    let itemsDataArray = [];
    const stockItemIds = Array.isArray(req.body.itemStockItemId) ? req.body.itemStockItemId : [req.body.itemStockItemId];
    const productNames = Array.isArray(req.body.itemProductName) ? req.body.itemProductName : [req.body.itemProductName];
    const stockCodes = Array.isArray(req.body.itemStockCode) ? req.body.itemStockCode : [req.body.itemStockCode];
    const orderedQtys = Array.isArray(req.body.itemOrderedQty) ? req.body.itemOrderedQty : [req.body.itemOrderedQty];
    const prevReceivedQtys = Array.isArray(req.body.itemPrevReceivedQty) ? req.body.itemPrevReceivedQty : [req.body.itemPrevReceivedQty];
    const currentReceivedQtys = Array.isArray(req.body.itemCurrentReceivedQty) ? req.body.itemCurrentReceivedQty : [req.body.itemCurrentReceivedQty];
    const units = Array.isArray(req.body.itemUnit) ? req.body.itemUnit : [req.body.itemUnit];

    let totalReceivedInThisBatch = 0;

    for (let i = 0; i < stockItemIds.length; i++) {
      const sId = parseInt(stockItemIds[i], 10);
      const ordered = parseFloat(orderedQtys[i]) || 0;
      const prevRec = parseFloat(prevReceivedQtys[i]) || 0;
      const currRec = parseFloat(currentReceivedQtys[i]) || 0;

      if (currRec > 0) {
        totalReceivedInThisBatch += currRec;
      }

      itemsDataArray.push({
        stokId: sId,
        stokKodu: stockCodes[i] || '',
        ad: productNames[i] || '',
        birim: units[i] || 'Adet',
        orderedQuantity: ordered,
        previouslyReceivedQuantity: prevRec,
        currentReceivedQuantity: currRec,
        netRemainingQuantity: Math.max(0, ordered - (prevRec + currRec))
      });
    }

    if (totalReceivedInThisBatch <= 0) {
      throw new ValidationError('Teslim alınan miktar 0\'dan büyük olmalıdır.');
    }

    const grnNo = await goodsReceiptRepository.getNextGrnNo();

    const locVal = depoLokasyonu || warehouseLocation || po.teslimDeposu || 'Ana Hammadde & Üretim Ambarı';
    const rawWhName = locVal.replace(/&amp;/g, '&').trim();
    const { Op } = require('sequelize');

    let targetWarehouse = await Depo.findOne({
      where: {
        [Op.or]: [
          { ad: { [Op.iLike || Op.like]: rawWhName } },
          { ad: { [Op.iLike || Op.like]: `%${rawWhName}%` } },
          { depoKodu: { [Op.iLike || Op.like]: `%${rawWhName}%` } }
        ]
      }
    });

    if (!targetWarehouse) {
      targetWarehouse = await Depo.findOne({ where: { durum: 'Active' }, order: [['id', 'ASC']] });
    }

    const targetWhName = targetWarehouse ? targetWarehouse.ad : rawWhName;

    const grn = await MalKabul.create({
      kabulNo: grnNo,
      satinAlmaSiparisId: po.id,
      tedarikciId: po.tedarikciId || null,
      stokId: itemsDataArray[0] ? itemsDataArray[0].stokId : null,
      siparisMiktari: itemsDataArray[0] ? itemsDataArray[0].orderedQuantity : po.miktar,
      teslimAlinanMiktar: totalReceivedInThisBatch,
      kabulEdilenMiktar: totalReceivedInThisBatch,
      reddedilenMiktar: 0,
      kabulTarihi: new Date().toISOString().split('T')[0],
      irsaliyeNo: (irsaliyeNo || deliveryNoteNo) ? (irsaliyeNo || deliveryNoteNo).trim() : null,
      kalemlerVerisi: JSON.stringify(itemsDataArray),
      depoLokasyonu: targetWhName,
      durum: 'Completed',
      kaliteDurumu: 'Approved',
      notlar: (notlar || notes) || null,
      kabulEdenId: req.user.id
    });

    for (const itemRec of itemsDataArray) {
      if (itemRec.currentReceivedQuantity > 0 && itemRec.stokId) {
        const stockItem = await StokKarti.findByPk(itemRec.stokId);
        if (stockItem) {
          stockItem.mevcutStok = parseFloat(stockItem.mevcutStok) + itemRec.currentReceivedQuantity;
          await stockItem.save();

          const moveNo = `GRN-${Date.now().toString().slice(-6)}-${itemRec.stokId}`;
          await StokHareketi.create({
            hareketNo: moveNo,
            stokId: stockItem.id,
            varisDepoId: targetWarehouse ? targetWarehouse.id : 1,
            hareketTuru: 'Inbound',
            miktar: itemRec.currentReceivedQuantity,
            birimFiyat: po.birimFiyat || 0,
            referansNo: grnNo,
            notlar: `[Mal Kabul Girişi] İrsaliye No: ${irsaliyeNo || deliveryNoteNo || '—'} | Fiş: ${grnNo} | Hedef Depo: ${targetWhName}`,
            yapanKullaniciId: req.user.id
          });
        }
      }
    }

    try {
      if (targetWarehouse) {
        let whItems = [];
        const whKalem = targetWarehouse.kalemlerJson || targetWarehouse.itemsJson;
        if (whKalem) {
          try {
            whItems = typeof whKalem === 'string' ? JSON.parse(whKalem) : whKalem;
          } catch (e) { whItems = []; }
        }
        if (!Array.isArray(whItems)) whItems = [];

        for (const itemRec of itemsDataArray) {
          if (itemRec.currentReceivedQuantity > 0 && itemRec.stokId) {
            const sId = parseInt(itemRec.stokId, 10);
            const existingItem = whItems.find(it => parseInt(it.stokId || it.stockItemId, 10) === sId || (it.stokKodu && it.stokKodu === itemRec.stokKodu));
            
            if (existingItem) {
              existingItem.miktar = (parseFloat(existingItem.miktar || existingItem.quantity) || 0) + itemRec.currentReceivedQuantity;
              existingItem.lastUpdated = new Date().toISOString();
            } else {
              whItems.push({
                stokId: sId,
                stokKodu: itemRec.stokKodu || '',
                ad: itemRec.productName || 'Malzeme',
                kategori: itemRec.category || 'Hammadde',
                miktar: itemRec.currentReceivedQuantity,
                birim: itemRec.birim || 'Adet',
                lastUpdated: new Date().toISOString()
              });
            }
          }
        }

        targetWarehouse.kalemlerJson = JSON.stringify(whItems);
        await targetWarehouse.save();
      }
    } catch (whErr) {
      console.error('Error updating target warehouse inventory balance:', whErr);
    }

    const receivedTotals = await goodsReceiptRepository.getReceivedTotalsForOrder(po.id);
    let orderItems = [];
    const poKalem = po.kalemlerJson || po.itemsJson;
    if (poKalem) {
      try { orderItems = typeof poKalem === 'string' ? JSON.parse(poKalem) : poKalem; } catch (e) { orderItems = []; }
    }
    if (!orderItems || orderItems.length === 0) {
      orderItems = [{ stokId: po.stokId, miktar: po.miktar }];
    }

    let isAllFullyReceived = true;
    for (const ordItem of orderItems) {
      const sId = parseInt(ordItem.stokId || ordItem.stockItemId, 10);
      const ordQty = parseFloat(ordItem.miktar || ordItem.quantity) || 0;
      const totalRec = receivedTotals[sId] || 0;
      if (totalRec < ordQty) {
        isAllFullyReceived = false;
        break;
      }
    }

    if (isAllFullyReceived) {
      await po.update({ durum: 'Received' });
    } else {
      await po.update({ durum: 'Partial_Received' });
    }

    res.redirect(`/stock/goods-receipt?success=receipt_created&grnNo=${encodeURIComponent(grnNo)}`);
  });

  viewGoodsReceiptHistory = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const po = await SatinAlmaSiparisi.findByPk(orderId, {
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: Tedarikci, as: 'tedarikci' }
      ]
    });
    if (!po) throw new NotFoundError('Satın alma siparişi bulunamadı.');

    const pastReceipts = await goodsReceiptRepository.getReceiptsByOrderId(orderId);

    const formattedReceipts = pastReceipts.map(gr => {
      let items = [];
      const grKalem = gr.kalemlerVerisi || gr.itemsData;
      if (grKalem) {
        try { items = typeof grKalem === 'string' ? JSON.parse(grKalem) : grKalem; } catch (e) { items = []; }
      }
      return {
        ...gr.toJSON(),
        itemsList: items
      };
    });

    res.render('stock/goods_receipt_history', {
      user: req.user,
      order: po,
      receipts: formattedReceipts
    });
  });

  confirmGoodsReceipt = asyncHandler(async (req, res) => {
    const { id } = req.params;
    res.redirect(`/stock/goods-receipt/create?orderId=${id}`);
  });

  // 6. DISPATCH (SATIŞ SEVKİYAT VE ÇIKIŞ)
  listDispatch = asyncHandler(async (req, res) => {
    const salesOrders = await salesRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/dispatch', {
      user: req.user,
      salesOrders,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'dispatch'
    });
  });

  confirmDispatch = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await salesRepository.updateStatus(id, 'Completed', req.user, req.ip);
    res.redirect('/stock/dispatch');
  });

  // 7. INVENTORY COUNTING & RECONCILIATION
  listCounting = asyncHandler(async (req, res) => {
    const countings = await stockRepository.findAllCountings();
    const stockItems = await stockRepository.findAll();
    const warehouses = await stockRepository.findAllWarehouses();

    res.render('stock/counting', {
      user: req.user,
      countings,
      stockItems,
      warehouses,
      ALL_ROLES,
      activeSubTab: 'counting'
    });
  });

  addCounting = asyncHandler(async (req, res) => {
    const { warehouseId, depoId, countDate, sayimTarihi, notes, notlar } = req.body;
    const targetDepoId = depoId || warehouseId;
    if (!targetDepoId) throw new ValidationError('Depo seçimi zorunludur.');

    await stockRepository.createCounting({
      depoId: targetDepoId,
      sayimTarihi: sayimTarihi || countDate,
      notlar: notlar || notes
    }, req.user, req.ip);

    res.redirect('/stock/counting');
  });

  // 8. CRITICAL STOCK & MIN/MAX ALERTS
  listAlerts = asyncHandler(async (req, res) => {
    const lowStockItems = await stockRepository.getLowStockAlerts();
    const requisitions = await requisitionRepository.findAll({ sourceModule: 'Stock' });

    const { SatinAlmaTalebi, UretimEmri } = require('../../models');
    const { Op } = require('sequelize');

    const pendingPurchaseReqs = await SatinAlmaTalebi.findAll({
      where: {
        durum: { [Op.in]: ['Pending', 'Approved'] }
      }
    });

    const pendingProductionOrders = await UretimEmri.findAll({
      where: {
        durum: { [Op.in]: ['Planned', 'In_Production', 'Quality_Check'] }
      }
    });

    const pendingPurchaseStockItemIds = new Set(pendingPurchaseReqs.map(r => parseInt(r.stokId, 10)));
    const pendingProductionStockItemIds = new Set(pendingProductionOrders.map(o => parseInt(o.stokId, 10)));

    lowStockItems.forEach(item => {
      item.hasPendingPurchaseReq = pendingPurchaseStockItemIds.has(item.id);
      item.hasPendingProductionOrder = pendingProductionStockItemIds.has(item.id);
    });

    let successMsg = null;
    if (req.query.success === 'purchase') {
      successMsg = '🛒 Satın Alma Talebi başarıyla oluşturuldu ve Satın Alma Modülüne (Talepler Kartına) iletildi.';
    } else if (req.query.success === 'production') {
      successMsg = '⚙️ Üretim Talebi / İş Emri başarıyla oluşturuldu ve Üretim Planlama Modülüne (Talepler Kartına) iletildi.';
    } else if (req.query.success === 'true') {
      successMsg = 'Talebiniz başarıyla ilgili modüle iletildi.';
    }

    res.render('stock/alerts', {
      user: req.user,
      lowStockItems,
      requisitions,
      ALL_ROLES,
      activeSubTab: 'alerts',
      successMsg
    });
  });

  createStockRequisition = asyncHandler(async (req, res) => {
    const { stockItemId, stokId, requestedQuantity, talepEdilenMiktar, urgency, aciliyet, notes, notlar, targetModule, redirectUrl } = req.body;
    const targetStokId = stokId || stockItemId;

    if (!targetStokId) {
      throw new ValidationError('Malzeme seçimi zorunludur.');
    }

    const item = await stockRepository.findById(targetStokId);
    if (!item) {
      throw new NotFoundError('Stok kalemi bulunamadı.');
    }

    const minStk = parseFloat(item.asgariStok || item.minStock || 0);
    const currStk = parseFloat(item.mevcutStok || item.currentStock || 0);
    const missingAmount = minStk - currStk;
    const qty = parseFloat(talepEdilenMiktar || requestedQuantity) || (missingAmount > 0 ? missingAmount : 10);

    const forcePurchase = (targetModule === 'purchase' || targetModule === 'Purchase' || req.body.module === 'purchase');
    const pMethod = item.tedarikYontemi || item.procurementMethod || ((item.kategori === 'Mamul' || item.kategori === 'Yari_Mamul' || item.kategori === 'Yarı_Mamul') ? 'Üretim' : 'Satın Alma');
    const isProductionItem = !forcePurchase && (pMethod === 'Üretim' || pMethod === 'Production');

    if (isProductionItem) {
      const productionRepository = require('../repositories/productionRepository');
      const nextWorkOrderNo = await productionRepository.generateWorkOrderNo();

      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      await productionRepository.create({
        isEmriNo: nextWorkOrderNo,
        uretimBasligi: `[Kritik Stok Uyarısı] ${item.ad} Üretim Talebi`,
        stokId: item.id,
        planlananMiktar: qty,
        birim: item.birim || 'Adet',
        durum: 'Planned',
        oncelik: (aciliyet || urgency) === 'Urgent' ? 'Urgent' : 'High',
        isMerkezi: item.kategori === 'Mamul' ? 'Montaj İstasyonu' : 'İşleme İstasyonu',
        planlananBaslangicTarihi: today.toISOString().split('T')[0],
        planlananBitisTarihi: nextWeek.toISOString().split('T')[0],
        notlar: notlar || notes || `🚨 [Kritik Stok Uyarısı] Depoda '${item.ad}' ürünü kritik seviyededir (Mevcut: ${currStk} ${item.birim}, Min: ${minStk} ${item.birim}). Tedarik Yöntemi: Üretim. Lütfen acil imalatını tamamlayın.`,
        olusturanId: req.user.id
      }, req.user, req.ip);

      return res.redirect(redirectUrl || '/stock/alerts?success=production');
    } else {
      const nextReqNo = await purchaseService.getNextRequisitionNo();

      await purchaseService.createRequisition({
        talepNo: nextReqNo,
        kaynakModul: 'Stock',
        stokId: item.id,
        talepEdilenMiktar: qty,
        birim: item.birim || 'Adet',
        aciliyet: (aciliyet || urgency) === 'Urgent' ? 'Urgent' : ((aciliyet || urgency) === 'High' ? 'High' : 'Normal'),
        durum: 'Pending',
        talepEdenAdi: req.user.ad ? `${req.user.ad} ${req.user.soyad}` : req.user.kullaniciAdi,
        notlar: notlar || notes || `🚨 [Stok Modülünden Gelen Talep] Depodan '${item.ad}' malzemesi için satın alma talebi oluşturulmuştur. (Mevcut: ${currStk} ${item.birim}, Min: ${minStk} ${item.birim}).`,
        olusturanId: req.user.id
      }, req.user, req.ip);

      return res.redirect(redirectUrl || '/stock/alerts?success=purchase');
    }
  });

  // 9. INVENTORY VALUATION (FIFO / WEIGHTED AVERAGE)
  listValuation = asyncHandler(async (req, res) => {
    const valuationReport = await stockValuationService.calculateValuation();

    res.render('stock/valuation', {
      user: req.user,
      valuationItems: valuationReport.valuationItems,
      totalAvgValuation: valuationReport.totalAvgValuation,
      totalFifoValuation: valuationReport.totalFifoValuation,
      categorySummary: valuationReport.categorySummary,
      ALL_ROLES,
      activeSubTab: 'valuation'
    });
  });

  // 10. RF HANDHELD TERMINAL & BARCODE SCANNER
  renderTerminal = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();

    res.render('stock/terminal', {
      user: req.user,
      stockItems,
      ALL_ROLES,
      activeSubTab: 'terminal'
    });
  });
}

module.exports = new StockController();
