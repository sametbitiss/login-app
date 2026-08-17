const { ProductionOrder, StockItem, BOMItem, RoutingOperation, User, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class ProductionRepository {
  async generateWorkOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `URETIM-${year}-`;
    const lastOrder = await ProductionOrder.findOne({
      where: { workOrderNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return `${prefix}0001`;

    const lastNo = lastOrder.workOrderNo.replace(prefix, '');
    const nextSeq = parseInt(lastNo, 10) + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async findAll(filters = {}) {
    const where = {};
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.workCenter) where.workCenter = filters.workCenter;

    if (filters.search) {
      where[Op.or] = [
        { workOrderNo: { [Op.iLike]: `%${filters.search}%` } },
        { productionTitle: { [Op.iLike]: `%${filters.search}%` } },
        { workCenter: { [Op.iLike]: `%${filters.search}%` } }
      ];
    }

    return await ProductionOrder.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit', 'currentStock'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await ProductionOrder.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem' }
      ]
    });
  }

  async create(orderData, currentUser = null, ipAddress = null) {
    if (!orderData.workOrderNo) {
      orderData.workOrderNo = await this.generateWorkOrderNo();
    }

    const newOrder = await ProductionOrder.create(orderData);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'ProductionOrder',
      entityId: newOrder.id,
      details: { workOrderNo: newOrder.workOrderNo, title: newOrder.productionTitle, plannedQty: newOrder.plannedQuantity },
      ipAddress
    });

    return newOrder;
  }

  async updateStatus(id, newStatus, currentUser = null, ipAddress = null) {
    const order = await ProductionOrder.findByPk(id);
    if (!order) return null;

    const oldStatus = order.status;
    order.status = newStatus;

    if (newStatus === 'In_Production' && !order.actualStartDate) {
      order.actualStartDate = new Date();
    }

    // When status changes to Completed, automatically increase product stock in StockItem
    if (newStatus === 'Completed' && oldStatus !== 'Completed') {
      order.actualEndDate = new Date();
      if (!order.completedQuantity || parseFloat(order.completedQuantity) === 0) {
        order.completedQuantity = order.plannedQuantity;
      }

      const stockItem = await StockItem.findByPk(order.stockItemId);
      if (stockItem) {
        const qtyToAdd = parseFloat(order.completedQuantity || order.plannedQuantity) || 1;
        const previousStock = parseFloat(stockItem.currentStock) || 0;
        stockItem.currentStock = previousStock + qtyToAdd;
        await stockItem.save();

        await logService.logCrud({
          userId: currentUser ? currentUser.id : null,
          username: currentUser ? currentUser.username : 'System',
          action: 'STOCK_INCREMENT_PRODUCTION',
          entity: 'StockItem',
          entityId: stockItem.id,
          details: {
            workOrderNo: order.workOrderNo,
            productName: stockItem.name,
            previousStock,
            addedQuantity: qtyToAdd,
            newStock: stockItem.currentStock
          },
          ipAddress
        });

        // Deduct raw material BOM components from stock
        const boms = await BOMItem.findAll({ where: { finishedStockItemId: order.stockItemId } });
        for (const bom of boms) {
          const compItem = await StockItem.findByPk(bom.componentStockItemId);
          if (compItem) {
            const reqQty = (qtyToAdd * parseFloat(bom.quantityRequired)) * (1 + (parseFloat(bom.scrapPercentage || 0) / 100));
            const compPrevStock = parseFloat(compItem.currentStock) || 0;
            compItem.currentStock = Math.max(0, compPrevStock - reqQty);
            await compItem.save();

            const { StockMovement } = require('../../models');
            await StockMovement.create({
              movementNo: `SH-${Date.now().toString().slice(-6)}`,
              stockItemId: compItem.id,
              sourceWarehouseId: 1,
              movementType: 'Outbound',
              quantity: reqQty,
              unitPrice: compItem.purchasePrice || 0,
              referenceNo: order.workOrderNo,
              notes: `[Üretim Sarfı] ${order.workOrderNo} üretimi için reçeteli hammadde stoktan düşüldü.`,
              performedBy: currentUser ? currentUser.id : null
            });
          }
        }
      }
    }

    await order.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'ProductionOrder',
      entityId: order.id,
      details: { field: 'status', oldStatus, newStatus },
      ipAddress
    });

    return order;
  }

  // --- BOM (BILL OF MATERIALS) METHODS ---
  async findAllBOM() {
    return await BOMItem.findAll({
      include: [
        { model: StockItem, as: 'finishedProduct', attributes: ['id', 'stockCode', 'name', 'unit', 'category', 'currentStock'] },
        { model: StockItem, as: 'componentItem', attributes: ['id', 'stockCode', 'name', 'unit', 'currentStock', 'purchasePrice', 'currency', 'category'] },
        { model: StockItem, as: 'alternativeComponentItem', attributes: ['id', 'stockCode', 'name', 'unit'] }
      ],
      order: [['finishedStockItemId', 'ASC'], ['level', 'ASC'], ['id', 'ASC']]
    });
  }

  async findAllBOMGroupedByProduct() {
    // 1. Get all finished/semi-finished products (Mamul & Yarı Mamul)
    const targetProducts = await StockItem.findAll({
      where: {
        status: 'Active',
        category: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] },
        procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // 2. Get all BOM Items
    const allBOMItems = await this.findAllBOM();

    // Map BOM Items by finishedStockItemId
    const bomMap = {};
    allBOMItems.forEach(item => {
      if (!bomMap[item.finishedStockItemId]) {
        bomMap[item.finishedStockItemId] = [];
      }
      bomMap[item.finishedStockItemId].push(item);
    });

    // 3. Construct product-based list with BOM status
    const productBOMList = targetProducts.map(product => {
      const items = bomMap[product.id] || [];
      const hasBOM = items.length > 0;
      const version = hasBOM ? items[0].version : 'Rev.01';
      const baseQuantity = hasBOM ? parseFloat(items[0].baseQuantity || 1.0) : 1.0;

      let totalUnitCost = 0;
      items.forEach(b => {
        const compPrice = b.componentItem ? parseFloat(b.componentItem.purchasePrice || 0) : 0;
        const reqQty = parseFloat(b.quantityRequired || 0);
        const scrap = parseFloat(b.scrapPercentage || 0);
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
    const newBOM = await BOMItem.create(bomData);
    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'BOMItem',
      entityId: newBOM.id,
      details: bomData,
      ipAddress
    });
    return newBOM;
  }

  async saveProductBOM(finishedStockItemId, bomHeaderData, currentUser = null, ipAddress = null) {
    const { version, baseQuantity, components } = bomHeaderData;

    // Delete existing BOM Items for this product
    await BOMItem.destroy({ where: { finishedStockItemId } });

    const createdItems = [];
    if (components && components.length > 0) {
      const finishedProduct = await StockItem.findByPk(finishedStockItemId);
      const codePrefix = finishedProduct ? finishedProduct.stockCode.replace(/[^a-zA-Z0-9]/g, '') : `PRD${finishedStockItemId}`;
      const bomCode = `BOM-${codePrefix}-${version ? version.replace(/[^a-zA-Z0-9]/g, '') : 'V1'}`;

      for (const comp of components) {
        if (!comp.componentStockItemId) continue;

        // Check if component itself is a Yarı Mamul (for Level estimation)
        const compItem = await StockItem.findByPk(comp.componentStockItemId);
        const isSemiFinished = compItem && (compItem.category === 'Yari_Mamul' || compItem.category === 'Yarı_Mamul');
        const calcLevel = isSemiFinished ? 2 : 3;

        const newBOM = await BOMItem.create({
          bomCode,
          finishedStockItemId: parseInt(finishedStockItemId, 10),
          componentStockItemId: parseInt(comp.componentStockItemId, 10),
          version: version || 'Rev.01',
          baseQuantity: parseFloat(baseQuantity) || 1.0,
          quantityRequired: parseFloat(comp.quantityRequired) || 1.0,
          unit: comp.unit || (compItem ? compItem.unit : 'Adet'),
          scrapPercentage: parseFloat(comp.scrapPercentage) || 0.0,
          level: calcLevel,
          operationCode: comp.operationCode || null,
          alternativeComponentItemId: comp.alternativeComponentItemId ? parseInt(comp.alternativeComponentItemId, 10) : null,
          alternativeNotes: comp.alternativeNotes || null,
          notes: comp.notes || null
        });

        createdItems.push(newBOM);
      }
    }

    // Auto-complete any pending BOM Requisitions for this product
    try {
      const { ProductionOrder } = require('../../models');
      await ProductionOrder.update(
        { status: 'Completed', completedQuantity: 1 },
        {
          where: {
            stockItemId: finishedStockItemId,
            [Op.or]: [
              { workOrderNo: { [Op.like]: 'REQ-BOM-%' } },
              { productionTitle: { [Op.like]: '%Reçete Oluşturma%' } }
            ],
            status: 'Planned'
          }
        }
      );
    } catch (err) {
      console.error('Error auto-completing BOM Requisition:', err);
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'BOMItem',
      entityId: finishedStockItemId,
      details: { finishedStockItemId, version, baseQuantity, count: createdItems.length },
      ipAddress
    });

    return createdItems;
  }

  async deleteProductBOM(finishedStockItemId, currentUser = null, ipAddress = null) {
    const deletedCount = await BOMItem.destroy({ where: { finishedStockItemId } });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'DELETE',
      entity: 'BOMItem',
      entityId: finishedStockItemId,
      details: { finishedStockItemId, deletedCount },
      ipAddress
    });

    return deletedCount;
  }

  // --- ROUTING OPERATIONS METHODS ---
  async findAllRoutings() {
    return await RoutingOperation.findAll({
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit', 'category', 'currentStock'] }
      ],
      order: [['stockItemId', 'ASC'], ['operationSeq', 'ASC']]
    });
  }

  async findAllRoutingsGroupedByProduct() {
    // 1. Fetch products with BOM (candidate products for routing)
    const existingBOMs = await BOMItem.findAll({
      attributes: ['finishedStockItemId'],
      group: ['finishedStockItemId']
    });
    const finishedItemIds = existingBOMs.map(b => b.finishedStockItemId);

    const candidateProducts = await StockItem.findAll({
      where: {
        id: { [Op.in]: finishedItemIds },
        status: 'Active',
        category: { [Op.in]: ['Mamul', 'Yari_Mamul', 'Yarı_Mamul'] },
        procurementMethod: { [Op.in]: ['Üretim', 'Production'] }
      },
      order: [['category', 'ASC'], ['name', 'ASC']]
    });

    // 2. Fetch all routing operations
    const allOperations = await this.findAllRoutings();

    const routingMap = {};
    allOperations.forEach(op => {
      if (!routingMap[op.stockItemId]) {
        routingMap[op.stockItemId] = [];
      }
      routingMap[op.stockItemId].push(op);
    });

    // 3. Build product-level routing summary
    return candidateProducts.map(product => {
      const ops = routingMap[product.id] || [];
      const hasRouting = ops.length > 0;
      let totalSetupTime = 0;
      let totalRunTime = 0;
      const workCentersSet = new Set();

      ops.forEach(o => {
        totalSetupTime += parseFloat(o.setupTimeMinutes || 0);
        totalRunTime += parseFloat(o.runTimeMinutesPerUnit || 0);
        if (o.workCenter) workCentersSet.add(o.workCenter);
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

  async getMultiLevelProductionPlan(stockItemId, plannedQuantity = 1) {
    const validStockItemId = parseInt(stockItemId, 10);
    const mainProduct = await StockItem.findByPk(validStockItemId);
    if (!mainProduct) return [];

    const planItemsMap = new Map();

    // Helper recursive function to traverse BOM & Routings
    const traverseBOM = async (productId, requiredQty, currentLevel = 1) => {
      const product = await StockItem.findByPk(productId);
      if (!product) return;

      // Fetch product's BOM items
      const bomItems = await BOMItem.findAll({
        where: { finishedStockItemId: productId },
        include: [{ model: StockItem, as: 'componentItem' }],
        order: [['level', 'ASC'], ['id', 'ASC']]
      });

      // Fetch product's Routing Operations
      const routingOperations = await RoutingOperation.findAll({
        where: { stockItemId: productId },
        order: [['operationSeq', 'ASC']]
      });

      const maxLevel = bomItems.length > 0 ? Math.max(...bomItems.map(b => b.level || (currentLevel + 1))) : currentLevel;
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

      // Recursively traverse sub-assemblies (Yarı Mamul with procurementMethod = Üretim)
      for (const b of bomItems) {
        const comp = b.componentItem;
        if (comp && ['Yarı_Mamul', 'Yari_Mamul'].includes(comp.category) && ['Üretim', 'Production'].includes(comp.procurementMethod)) {
          const compQty = requiredQty * (parseFloat(b.quantityRequired || 1) / parseFloat(b.baseQuantity || 1));
          await traverseBOM(comp.id, compQty, b.level || (currentLevel + 1));
        }
      }
    };

    await traverseBOM(validStockItemId, parseFloat(plannedQuantity) || 1, 1);

    // Convert map to array and SORT BY LEVEL DESC! (Higher level number = deeper component = MUST BE PRODUCED FIRST!)
    const planItems = Array.from(planItemsMap.values());
    planItems.sort((a, b) => b.level - a.level);

    return planItems;
  }

  async saveProductRouting(stockItemId, operationsArray, currentUser = null, ipAddress = null) {
    const validStockItemId = parseInt(stockItemId, 10);
    const targetProduct = await StockItem.findByPk(validStockItemId);
    if (!targetProduct) {
      throw new Error('Geçersiz ürün kimliği.');
    }

    // Replace existing operations for this product
    await RoutingOperation.destroy({ where: { stockItemId: validStockItemId } });

    const createdOperations = [];
    if (Array.isArray(operationsArray) && operationsArray.length > 0) {
      for (let i = 0; i < operationsArray.length; i++) {
        const op = operationsArray[i];
        const seq = parseInt(op.operationSeq, 10) || (i + 1) * 10;
        const code = op.operationCode || `OPS-${String(seq).padStart(2, '0')}`;
        const name = op.operationName || `Operasyon Adımı #${i + 1}`;
        const wc = op.workCenter || 'İstasyon-1 (Kesim & Büküm)';
        const setup = parseFloat(op.setupTimeMinutes) || 15.0;
        const run = parseFloat(op.runTimeMinutesPerUnit) || 5.0;
        const operators = parseInt(op.operatorCount, 10) || 1;
        const inst = op.instructions || null;
        let usedComps = null;
        if (Array.isArray(op.usedComponents)) {
          usedComps = JSON.stringify(op.usedComponents);
        } else if (typeof op.usedComponents === 'string') {
          usedComps = op.usedComponents;
        }

        const newOp = await RoutingOperation.create({
          routingCode: `ROT-${targetProduct.stockCode}-v1`,
          stockItemId: validStockItemId,
          operationSeq: seq,
          operationCode: code,
          operationName: name,
          workCenter: wc,
          setupTimeMinutes: setup,
          runTimeMinutesPerUnit: run,
          operatorCount: operators,
          instructions: inst,
          usedComponents: usedComps
        });

        createdOperations.push(newOp);
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'RoutingOperation',
      entityId: validStockItemId,
      details: { stockItemId: validStockItemId, count: createdOperations.length },
      ipAddress
    });

    return createdOperations;
  }

  async deleteProductRouting(stockItemId, currentUser = null, ipAddress = null) {
    const validStockItemId = parseInt(stockItemId, 10);
    const deletedCount = await RoutingOperation.destroy({ where: { stockItemId: validStockItemId } });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'DELETE',
      entity: 'RoutingOperation',
      entityId: validStockItemId,
      details: { stockItemId: validStockItemId, deletedCount },
      ipAddress
    });

    return deletedCount;
  }

  // --- MES (MANUFACTURING EXECUTION SYSTEM) SHOP FLOOR UPDATE ---
  async updateMESData(id, mesData, currentUser = null, ipAddress = null) {
    const order = await ProductionOrder.findByPk(id);
    if (!order) return null;

    if (mesData.completedQuantity !== undefined) order.completedQuantity = parseFloat(mesData.completedQuantity);
    if (mesData.scrapQuantity !== undefined) order.scrapQuantity = parseFloat(mesData.scrapQuantity);
    if (mesData.actualHours !== undefined) order.actualHours = parseFloat(mesData.actualHours);
    if (mesData.notes) order.notes = mesData.notes;

    await order.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE_MES',
      entity: 'ProductionOrder',
      entityId: order.id,
      details: mesData,
      ipAddress
    });

    return order;
  }

  async getStats() {
    const totalOrders = await ProductionOrder.count();
    const plannedOrders = await ProductionOrder.count({ where: { status: 'Planned' } });
    const inProductionOrders = await ProductionOrder.count({ where: { status: 'In_Production' } });
    const completedOrders = await ProductionOrder.count({ where: { status: 'Completed' } });
    
    const totalPlannedQtyResult = await ProductionOrder.sum('plannedQuantity', { where: { status: { [Op.ne]: 'Cancelled' } } });

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
