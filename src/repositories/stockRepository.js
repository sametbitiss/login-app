const {
  StockItem,
  Warehouse,
  StockLocation,
  StockLot,
  StockMovement,
  StockCounting,
  User,
  sequelize
} = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class StockRepository {
  // --- 1. STOCK ITEMS METHODS ---
  async findAll(filters = {}) {
    const where = {};
    const validCategories = ['Hammadde', 'Yari_Mamul', 'Yarı_Mamul', 'Mamul', 'Yedek_Parca', 'Ambalaj', 'Ticari_Mal', 'Hizmet', 'Diger'];
    const validStatuses = ['Active', 'Passive', 'Discontinued'];

    if (filters.status && validStatuses.includes(filters.status)) {
      where.status = filters.status;
    }

    if (filters.category) {
      if (validCategories.includes(filters.category)) {
        where.category = filters.category;
      } else {
        const alt = filters.category === 'Yarı_Mamul' ? 'Yari_Mamul' : filters.category === 'Yari_Mamul' ? 'Yarı_Mamul' : null;
        if (alt && validCategories.includes(alt)) {
          where.category = alt;
        }
      }
    }

    if (filters.search) {
      where[Op.or] = [
        { name: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { stockCode: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { barcode: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await StockItem.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }]
    });
  }

  async findById(id) {
    const validId = parseInt(id, 10);
    if (!validId || Number.isNaN(validId) || validId <= 0) return null;
    return await StockItem.findByPk(validId, {
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }]
    });
  }

  async findByStockCode(stockCode) {
    return await StockItem.findOne({ where: { stockCode } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      ...data,
      barcode: (data.barcode && data.barcode.trim()) ? data.barcode.trim() : null,
      category: data.category || 'Ticari_Mal',
      unit: data.unit || 'Adet',
      currency: data.currency || 'TRY',
      currentStock: (data.currentStock !== undefined && data.currentStock !== '' && !isNaN(parseFloat(data.currentStock))) ? parseFloat(data.currentStock) : 0,
      minStock: (data.minStock !== undefined && data.minStock !== '' && !isNaN(parseFloat(data.minStock))) ? parseFloat(data.minStock) : 0,
      maxStock: (data.maxStock !== undefined && data.maxStock !== '' && !isNaN(parseFloat(data.maxStock))) ? parseFloat(data.maxStock) : null,
      purchasePrice: (data.purchasePrice !== undefined && data.purchasePrice !== '' && !isNaN(parseFloat(data.purchasePrice))) ? parseFloat(data.purchasePrice) : 0,
      salePrice: (data.salePrice !== undefined && data.salePrice !== '' && !isNaN(parseFloat(data.salePrice))) ? parseFloat(data.salePrice) : 0,
      taxRate: (data.taxRate !== undefined && data.taxRate !== '' && !isNaN(parseFloat(data.taxRate))) ? parseFloat(data.taxRate) : 20,
      shelfLife: (data.shelfLife !== undefined && data.shelfLife !== '' && !isNaN(parseInt(data.shelfLife, 10))) ? parseInt(data.shelfLife, 10) : null,
      weight: (data.weight !== undefined && data.weight !== '' && !isNaN(parseFloat(data.weight))) ? parseFloat(data.weight) : null,
      dimensions: (data.dimensions && data.dimensions.trim()) ? data.dimensions.trim() : null,
      brand: (data.brand && data.brand.trim()) ? data.brand.trim() : null,
      model: (data.model && data.model.trim()) ? data.model.trim() : null,
      warehouseLocation: (data.warehouseLocation && data.warehouseLocation.trim()) ? data.warehouseLocation.trim() : null,
      supplier: (data.supplier && data.supplier.trim()) ? data.supplier.trim() : null,
      notes: (data.notes && data.notes.trim()) ? data.notes.trim() : null,
      createdBy: currentUser ? currentUser.id : null
    };

    const item = await StockItem.create(cleanData);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'StockItem',
      entityId: item.id,
      details: { stockCode: item.stockCode, name: item.name, category: item.category, currentStock: item.currentStock },
      ipAddress
    });

    return item;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const item = await StockItem.findByPk(id);
    if (!item) return null;

    const oldData = { name: item.name, currentStock: item.currentStock, salePrice: item.salePrice };
    await item.update(data);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'StockItem',
      entityId: item.id,
      details: { oldData, newData: data },
      ipAddress
    });

    return item;
  }

  async delete(id, currentUser = null, ipAddress = null) {
    const item = await StockItem.findByPk(id);
    if (!item) return false;

    const deletedCode = item.stockCode;
    await item.destroy();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'DELETE',
      entity: 'StockItem',
      entityId: id,
      details: { stockCode: deletedCode },
      ipAddress
    });

    return true;
  }

  async getNextStockCode() {
    const items = await StockItem.findAll({ attributes: ['stockCode'] });
    let maxNum = 0;

    for (const item of items) {
      if (item.stockCode) {
        const matches = item.stockCode.match(/\d+/g);
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
    while (await StockItem.findOne({ where: { stockCode: nextCode } }) && attempts < 100) {
      nextNum++;
      nextCode = `STK-${String(nextNum).padStart(4, '0')}`;
      attempts++;
    }

    return nextCode;
  }

  // --- 2. MULTI-WAREHOUSE & LOCATION METHODS ---
  async findAllWarehouses() {
    return await Warehouse.findAll({
      include: [{ model: StockLocation, as: 'locations' }],
      order: [['id', 'ASC']]
    });
  }

  async createWarehouse(warehouseData, currentUser = null, ipAddress = null) {
    const newWh = await Warehouse.create(warehouseData);
    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'Warehouse',
      entityId: newWh.id,
      details: warehouseData,
      ipAddress
    });
    return newWh;
  }

  async createLocation(locationData, currentUser = null, ipAddress = null) {
    const newLoc = await StockLocation.create(locationData);
    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'StockLocation',
      entityId: newLoc.id,
      details: locationData,
      ipAddress
    });
    return newLoc;
  }

  // --- 3. LOT / BATCH & SERIAL NUMBER METHODS ---
  async findAllLots() {
    return await StockLot.findAll({
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] },
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'warehouseCode', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async createLot(lotData, currentUser = null, ipAddress = null) {
    const newLot = await StockLot.create(lotData);
    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'StockLot',
      entityId: newLot.id,
      details: lotData,
      ipAddress
    });
    return newLot;
  }

  // --- 4. MOVEMENTS & TRANSFERS METHODS ---
  async findAllMovements() {
    return await StockMovement.findAll({
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] },
        { model: Warehouse, as: 'sourceWarehouse', attributes: ['id', 'name'] },
        { model: Warehouse, as: 'targetWarehouse', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async createTransfer(transferData, currentUser = null, ipAddress = null) {
    const movementNo = `SH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const movement = await StockMovement.create({
      movementNo,
      stockItemId: transferData.stockItemId,
      sourceWarehouseId: transferData.sourceWarehouseId,
      targetWarehouseId: transferData.targetWarehouseId,
      movementType: 'Transfer',
      quantity: parseFloat(transferData.quantity),
      referenceNo: transferData.referenceNo || 'Depolar Arası Transfer',
      notes: transferData.notes,
      performedBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE_TRANSFER',
      entity: 'StockMovement',
      entityId: movement.id,
      details: transferData,
      ipAddress
    });

    return movement;
  }

  // --- 7. ENVENTORY COUNTING METHODS ---
  async findAllCountings() {
    return await StockCounting.findAll({
      include: [
        { model: Warehouse, as: 'warehouse', attributes: ['id', 'name'] },
        { model: User, as: 'user', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async createCounting(countData, currentUser = null, ipAddress = null) {
    const countNo = `SAYIM-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

    const newCount = await StockCounting.create({
      countNo,
      warehouseId: countData.warehouseId,
      countDate: countData.countDate || new Date().toISOString().split('T')[0],
      status: 'Completed',
      notes: countData.notes,
      performedBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE_COUNTING',
      entity: 'StockCounting',
      entityId: newCount.id,
      details: countData,
      ipAddress
    });

    return newCount;
  }

  // --- 8. CRITICAL STOCK & MIN/MAX ALERTS ---
  async getLowStockAlerts() {
    const items = await StockItem.findAll({
      order: [['currentStock', 'ASC']]
    });

    return items.filter(item => {
      const stock = parseFloat(item.currentStock) || 0;
      const min = parseFloat(item.minStock) || 0;
      return stock <= min;
    });
  }

  async getStats() {
    const total = await StockItem.count();
    const active = await StockItem.count({ where: { status: 'Active' } });
    const lowStock = await this.getLowStockAlerts();
    const warehouseCount = await Warehouse.count();
    const lotCount = await StockLot.count();

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
