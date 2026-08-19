const {
  StokKarti,
  Depo,
  StokLokasyonu,
  StokPartisi,
  StokHareketi,
  StokSayimi,
  Kullanici,
  UretimEmri,
  sequelize
} = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class StockRepository {
  // --- 1. STOCK ITEMS METHODS ---
  async findAll(filters = {}) {
    const where = {};
    const validCategories = ['Hammadde', 'Yari_Mamul', 'Yarı_Mamul', 'Mamul', 'Ticari_Mal', 'Diger'];
    const validStatuses = ['Active', 'Passive', 'Discontinued'];

    if (filters.status && validStatuses.includes(filters.status)) {
      where.durum = filters.status;
    }

    if (filters.category) {
      if (validCategories.includes(filters.category)) {
        where.kategori = filters.category;
      } else {
        const alt = filters.category === 'Yarı_Mamul' ? 'Yari_Mamul' : filters.category === 'Yari_Mamul' ? 'Yarı_Mamul' : null;
        if (alt && validCategories.includes(alt)) {
          where.kategori = alt;
        }
      }
    }

    if (filters.search) {
      where[Op.or] = [
        { ad: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { stokKodu: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { barkod: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await StokKarti.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi'] }]
    });
  }

  async findById(id) {
    const validId = parseInt(id, 10);
    if (!validId || Number.isNaN(validId) || validId <= 0) return null;
    return await StokKarti.findByPk(validId, {
      include: [{ model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }]
    });
  }

  async findByStockCode(stokKodu) {
    return await StokKarti.findOne({ where: { stokKodu } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const targetCategory = data.kategori || data.category || 'Ticari_Mal';
    let targetProcurementMethod = data.tedarikYontemi || data.procurementMethod;

    if (['Hammadde', 'Ticari_Mal', 'Ticari Mal'].includes(targetCategory)) {
      targetProcurementMethod = 'Satın Alma';
    } else if (['Mamul', 'Yarı_Mamul', 'Yari_Mamul'].includes(targetCategory)) {
      targetProcurementMethod = targetProcurementMethod || 'Üretim';
    } else {
      targetProcurementMethod = targetProcurementMethod || 'Satın Alma';
    }

    const cleanData = {
      stokKodu: data.stokKodu || data.stockCode,
      barkod: ((data.barkod || data.barcode) && (data.barkod || data.barcode).trim()) ? (data.barkod || data.barcode).trim() : null,
      ad: data.ad || data.name,
      aciklama: data.aciklama || data.description,
      kategori: targetCategory,
      tedarikYontemi: targetProcurementMethod,
      birim: data.birim || data.unit || 'Adet',
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      mevcutStok: ((data.mevcutStok || data.currentStock) !== undefined && (data.mevcutStok || data.currentStock) !== '' && !isNaN(parseFloat(data.mevcutStok || data.currentStock))) ? parseFloat(data.mevcutStok || data.currentStock) : 0,
      minStok: ((data.minStok || data.minStock) !== undefined && (data.minStok || data.minStock) !== '' && !isNaN(parseFloat(data.minStok || data.minStock))) ? parseFloat(data.minStok || data.minStock) : 0,
      maxStok: ((data.maxStok || data.maxStock) !== undefined && (data.maxStok || data.maxStock) !== '' && !isNaN(parseFloat(data.maxStok || data.maxStock))) ? parseFloat(data.maxStok || data.maxStock) : null,
      alisFiyati: ((data.alisFiyati || data.purchasePrice) !== undefined && (data.alisFiyati || data.purchasePrice) !== '' && !isNaN(parseFloat(data.alisFiyati || data.purchasePrice))) ? parseFloat(data.alisFiyati || data.purchasePrice) : 0,
      satisFiyati: ((data.satisFiyati || data.salePrice) !== undefined && (data.satisFiyati || data.salePrice) !== '' && !isNaN(parseFloat(data.satisFiyati || data.salePrice))) ? parseFloat(data.satisFiyati || data.salePrice) : 0,
      kdvOrani: ((data.kdvOrani || data.taxRate) !== undefined && (data.kdvOrani || data.taxRate) !== '' && !isNaN(parseFloat(data.kdvOrani || data.taxRate))) ? parseFloat(data.kdvOrani || data.taxRate) : 20,
      rafOmru: ((data.rafOmru || data.shelfLife) !== undefined && (data.rafOmru || data.shelfLife) !== '' && !isNaN(parseInt(data.rafOmru || data.shelfLife, 10))) ? parseInt(data.rafOmru || data.shelfLife, 10) : null,
      agirlik: ((data.agirlik || data.weight) !== undefined && (data.agirlik || data.weight) !== '' && !isNaN(parseFloat(data.agirlik || data.weight))) ? parseFloat(data.agirlik || data.weight) : null,
      boyutlar: ((data.boyutlar || data.dimensions) && (data.boyutlar || data.dimensions).trim()) ? (data.boyutlar || data.dimensions).trim() : null,
      marka: ((data.marka || data.brand) && (data.marka || data.brand).trim()) ? (data.marka || data.brand).trim() : null,
      model: ((data.model) && data.model.trim()) ? data.model.trim() : null,
      depoLokasyonu: ((data.depoLokasyonu || data.warehouseLocation) && (data.depoLokasyonu || data.warehouseLocation).trim()) ? (data.depoLokasyonu || data.warehouseLocation).trim() : null,
      tedarikci: ((data.tedarikci || data.supplier) && (data.tedarikci || data.supplier).trim()) ? (data.tedarikci || data.supplier).trim() : null,
      notlar: ((data.notlar || data.notes) && (data.notlar || data.notes).trim()) ? (data.notlar || data.notes).trim() : null,
      olusturanId: currentUser ? currentUser.id : null
    };

    const item = await StokKarti.create(cleanData);

    const isProductionItem = ['Mamul', 'Yarı_Mamul', 'Yari_Mamul'].includes(item.kategori) &&
                             ['Üretim', 'Production'].includes(item.tedarikYontemi);

    if (isProductionItem) {
      try {
        const reqNo = `REQ-BOM-${Date.now().toString().slice(-6)}`;
        const today = new Date().toISOString().split('T')[0];

        await UretimEmri.create({
          isEmriNo: reqNo,
          uretimBasligi: `📜 Reçete Oluşturma Talebi — ${item.ad}`,
          stokId: item.id,
          planlananMiktar: 1,
          birim: item.birim || 'Adet',
          durum: 'Planned',
          oncelik: 'High',
          isMerkezi: 'İstasyon-1 (Kesim & Büküm)',
          planlananBaslangicTarihi: today,
          planlananBitisTarihi: today,
          notlar: `Stok & Depo Modülünden yeni eklenen [${item.stokKodu}] ${item.ad} (${item.kategori === 'Mamul' ? 'Mamul' : 'Yarı Mamul'}) için otomatik reçete oluşturma talebi açıldı.`,
          olusturanId: currentUser ? currentUser.id : null
        });
      } catch (err) {
        console.error('Error creating automatic BOM Requisition:', err);
      }
    }

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'StokKarti',
      varlikId: item.id,
      detaylar: { stokKodu: item.stokKodu, ad: item.ad, kategori: item.kategori, mevcutStok: item.mevcutStok },
      ipAdresi: ipAddress
    });

    return item;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const item = await StokKarti.findByPk(id);
    if (!item) return null;

    const updateData = {};
    if (data.stokKodu !== undefined || data.stockCode !== undefined) updateData.stokKodu = data.stokKodu || data.stockCode;
    if (data.barkod !== undefined || data.barcode !== undefined) updateData.barkod = data.barkod || data.barcode;
    if (data.ad !== undefined || data.name !== undefined) updateData.ad = data.ad || data.name;
    if (data.aciklama !== undefined || data.description !== undefined) updateData.aciklama = data.aciklama || data.description;
    if (data.kategori !== undefined || data.category !== undefined) updateData.kategori = data.kategori || data.category;
    if (data.tedarikYontemi !== undefined || data.procurementMethod !== undefined) updateData.tedarikYontemi = data.tedarikYontemi || data.procurementMethod;
    if (data.birim !== undefined || data.unit !== undefined) updateData.birim = data.birim || data.unit;
    if (data.marka !== undefined || data.brand !== undefined) updateData.marka = data.marka || data.brand;
    if (data.model !== undefined) updateData.model = data.model;
    if (data.mevcutStok !== undefined || data.currentStock !== undefined) updateData.mevcutStok = data.mevcutStok !== undefined ? data.mevcutStok : data.currentStock;
    if (data.rezerveStok !== undefined || data.reservedStock !== undefined) updateData.rezerveStok = data.rezerveStok !== undefined ? data.rezerveStok : data.reservedStock;
    if (data.minStok !== undefined || data.minStock !== undefined) updateData.minStok = data.minStok !== undefined ? data.minStok : data.minStock;
    if (data.maxStok !== undefined || data.maxStock !== undefined) updateData.maxStok = data.maxStok !== undefined ? data.maxStok : data.maxStock;
    if (data.alisFiyati !== undefined || data.purchasePrice !== undefined) updateData.alisFiyati = data.alisFiyati !== undefined ? data.alisFiyati : data.purchasePrice;
    if (data.satisFiyati !== undefined || data.salePrice !== undefined) updateData.satisFiyati = data.satisFiyati !== undefined ? data.satisFiyati : data.salePrice;
    if (data.paraBirimi !== undefined || data.currency !== undefined) updateData.paraBirimi = data.paraBirimi || data.currency;
    if (data.kdvOrani !== undefined || data.taxRate !== undefined) updateData.kdvOrani = data.kdvOrani !== undefined ? data.kdvOrani : data.taxRate;
    if (data.depoLokasyonu !== undefined || data.warehouseLocation !== undefined) updateData.depoLokasyonu = data.depoLokasyonu || data.warehouseLocation;
    if (data.tedarikci !== undefined || data.supplier !== undefined) updateData.tedarikci = data.tedarikci || data.supplier;
    if (data.durum !== undefined || data.status !== undefined) updateData.durum = data.durum || data.status;
    if (data.notlar !== undefined || data.notes !== undefined) updateData.notlar = data.notlar || data.notes;

    const oldData = { ad: item.ad, mevcutStok: item.mevcutStok, satisFiyati: item.satisFiyati };
    await item.update(updateData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'StokKarti',
      varlikId: item.id,
      detaylar: { oldData, newData: updateData },
      ipAdresi: ipAddress
    });

    return item;
  }

  async delete(id, currentUser = null, ipAddress = null) {
    const item = await StokKarti.findByPk(id);
    if (!item) return false;

    const deletedCode = item.stokKodu;
    await item.destroy();

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'DELETE',
      varlik: 'StokKarti',
      varlikId: id,
      detaylar: { stokKodu: deletedCode },
      ipAdresi: ipAddress
    });

    return true;
  }

  async getNextStockCode() {
    const items = await StokKarti.findAll({ attributes: ['stokKodu'] });
    let maxNum = 0;

    for (const item of items) {
      if (item.stokKodu) {
        const matches = item.stokKodu.match(/\d+/g);
        if (matches) {
          const num = parseInt(matches[matches.length - 1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    let nextNum = maxNum + 1;
    let nextCode = `STK-${String(nextNum).padStart(4, '0')}`;

    let attempts = 0;
    while (await StokKarti.findOne({ where: { stokKodu: nextCode } }) && attempts < 100) {
      nextNum++;
      nextCode = `STK-${String(nextNum).padStart(4, '0')}`;
      attempts++;
    }

    return nextCode;
  }

  // --- 2. MULTI-WAREHOUSE & LOCATION METHODS ---
  async findAllWarehouses() {
    return await Depo.findAll({
      include: [{ model: StokLokasyonu, as: 'lokasyonlar' }],
      order: [['id', 'ASC']]
    });
  }

  async createWarehouse(warehouseData, currentUser = null, ipAddress = null) {
    const cleanWh = {
      depoKodu: warehouseData.depoKodu || warehouseData.warehouseCode,
      ad: warehouseData.ad || warehouseData.name,
      tur: warehouseData.tur || warehouseData.type || 'General',
      sehir: warehouseData.sehir || warehouseData.city || 'İstanbul',
      adres: warehouseData.adres || warehouseData.address,
      sorumluAdi: warehouseData.sorumluAdi || warehouseData.managerName,
      durum: warehouseData.durum || warehouseData.status || 'Active'
    };

    const newWh = await Depo.create(cleanWh);
    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'Depo',
      varlikId: newWh.id,
      detaylar: cleanWh,
      ipAdresi: ipAddress
    });
    return newWh;
  }

  async createLocation(locationData, currentUser = null, ipAddress = null) {
    const cleanLoc = {
      lokasyonKodu: locationData.lokasyonKodu || locationData.locationCode,
      depoId: locationData.depoId || locationData.warehouseId,
      koridor: locationData.koridor || locationData.aisle || 'Koridor-A',
      raf: locationData.raf || locationData.shelf || 'Raf-01',
      goz: locationData.goz || locationData.bin || 'Göz-01',
      kapasite: locationData.kapasite || locationData.capacity || 1000,
      durum: locationData.durum || locationData.status || 'Active'
    };

    const newLoc = await StokLokasyonu.create(cleanLoc);
    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'StokLokasyonu',
      varlikId: newLoc.id,
      detaylar: cleanLoc,
      ipAdresi: ipAddress
    });
    return newLoc;
  }

  // --- 3. LOT / BATCH & SERIAL NUMBER METHODS ---
  async findAllLots() {
    return await StokPartisi.findAll({
      include: [
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim'] },
        { model: Depo, as: 'depo', attributes: ['id', 'depoKodu', 'ad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async createLot(lotData, currentUser = null, ipAddress = null) {
    const cleanLot = {
      partiNo: lotData.partiNo || lotData.lotNumber,
      seriNo: lotData.seriNo || lotData.serialNumber,
      stokId: lotData.stokId || lotData.stockItemId,
      depoId: lotData.depoId || lotData.warehouseId,
      miktar: lotData.miktar !== undefined ? lotData.miktar : lotData.quantity,
      uretimTarihi: lotData.uretimTarihi || lotData.productionDate,
      sonKullanmaTarihi: lotData.sonKullanmaTarihi || lotData.expirationDate,
      kaliteDurumu: lotData.kaliteDurumu || lotData.qualityStatus || 'Approved',
      notlar: lotData.notlar || lotData.notes
    };

    const newLot = await StokPartisi.create(cleanLot);
    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'StokPartisi',
      varlikId: newLot.id,
      detaylar: cleanLot,
      ipAdresi: ipAddress
    });
    return newLot;
  }

  // --- 4. MOVEMENTS & TRANSFERS METHODS ---
  async findAllMovements() {
    return await StokHareketi.findAll({
      include: [
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim'] },
        { model: Depo, as: 'cikisDepo', attributes: ['id', 'ad'] },
        { model: Depo, as: 'varisDepo', attributes: ['id', 'ad'] },
        { model: Kullanici, as: 'kullanici', attributes: ['id', 'kullaniciAdi'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async createTransfer(transferData, currentUser = null, ipAddress = null) {
    const hareketNo = `SH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const movement = await StokHareketi.create({
      hareketNo,
      stokId: transferData.stokId || transferData.stockItemId,
      cikisDepoId: transferData.cikisDepoId || transferData.sourceWarehouseId,
      varisDepoId: transferData.varisDepoId || transferData.targetWarehouseId,
      hareketTuru: 'Transfer',
      miktar: parseFloat(transferData.miktar || transferData.quantity),
      referansNo: transferData.referansNo || transferData.referenceNo || 'Depolar Arası Transfer',
      notlar: transferData.notlar || transferData.notes,
      yapanKullaniciId: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE_TRANSFER',
      varlik: 'StokHareketi',
      varlikId: movement.id,
      detaylar: transferData,
      ipAdresi: ipAddress
    });

    return movement;
  }

  // --- 7. INVENTORY COUNTING METHODS ---
  async findAllCountings() {
    return await StokSayimi.findAll({
      include: [
        { model: Depo, as: 'depo', attributes: ['id', 'ad'] },
        { model: Kullanici, as: 'kullanici', attributes: ['id', 'kullaniciAdi'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async createCounting(countData, currentUser = null, ipAddress = null) {
    const sayimNo = `SAYIM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newCount = await StokSayimi.create({
      sayimNo,
      depoId: countData.depoId || countData.warehouseId,
      sayimTarihi: countData.sayimTarihi || countData.countDate || new Date().toISOString().split('T')[0],
      durum: 'Completed',
      notlar: countData.notlar || countData.notes,
      yapanKullaniciId: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE_COUNTING',
      varlik: 'StokSayimi',
      varlikId: newCount.id,
      detaylar: countData,
      ipAdresi: ipAddress
    });

    return newCount;
  }

  // --- 8. CRITICAL STOCK & MIN/MAX ALERTS ---
  async getLowStockAlerts() {
    const items = await StokKarti.findAll({
      order: [['mevcutStok', 'ASC']]
    });

    return items.filter(item => {
      const stock = parseFloat(item.mevcutStok) || 0;
      const min = parseFloat(item.minStok) || 0;
      return stock <= min;
    });
  }

  async getStats() {
    const total = await StokKarti.count();
    const active = await StokKarti.count({ where: { durum: 'Active' } });
    const lowStock = await this.getLowStockAlerts();
    const warehouseCount = await Depo.count();
    const lotCount = await StokPartisi.count();

    return {
      total,
      active,
      lowStockCount: lowStock.length,
      warehouseCount,
      lotCount
    };
  }
}

module.exports = new StockRepository();
