const { SaleOrder, User, StockItem, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class SaleRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.paymentTerm) {
      where.paymentTerm = filters.paymentTerm;
    }

    if (filters.search) {
      where[Op.or] = [
        { orderNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { customerName: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { customerTaxNo: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await SaleOrder.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit', 'currentStock'] }
      ]
    });
  }

  async findById(id) {
    const validId = parseInt(id, 10);
    if (!validId || Number.isNaN(validId) || validId <= 0) return null;
    return await SaleOrder.findByPk(validId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem' }
      ]
    });
  }

  async findByOrderNo(orderNo) {
    if (!orderNo) return null;
    return await SaleOrder.findOne({ where: { orderNo } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const safeInt = (val) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return null;
      const n = parseInt(val, 10);
      return Number.isNaN(n) ? null : n;
    };
    const safeFloat = (val, defaultVal = 0) => {
      if (val === null || val === undefined || val === '' || val === 'null' || val === 'undefined' || val === 'NaN') return defaultVal;
      const n = parseFloat(val);
      return Number.isNaN(n) ? defaultVal : n;
    };

    let customerId = safeInt(data.customerId);
    let stockItemId = safeInt(data.stockItemId);

    if (!stockItemId || stockItemId <= 0) {
      const defaultStock = await StockItem.findOne({ where: { status: 'Active' } });
      stockItemId = defaultStock ? defaultStock.id : 1;
    }

    const quantity = safeFloat(data.quantity, 1);
    const unitPrice = safeFloat(data.unitPrice, 0);
    const discountRate = safeFloat(data.discountRate, 0);
    const taxRate = safeFloat(data.taxRate, 20);
    const subtotal = safeFloat(data.subtotal, 0);
    const discountAmount = safeFloat(data.discountAmount, 0);
    const taxAmount = safeFloat(data.taxAmount, 0);
    const totalAmount = safeFloat(data.totalAmount, 0);

    const order = await SaleOrder.create({
      ...data,
      customerId,
      stockItemId,
      quantity,
      unitPrice,
      discountRate,
      taxRate,
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      createdBy: currentUser ? currentUser.id : null
    });

    // Reserve Stock for Order Items
    let itemsToReserve = [];
    if (order.itemsJson) {
      try { itemsToReserve = JSON.parse(order.itemsJson); } catch (e) { itemsToReserve = []; }
    }
    if (!Array.isArray(itemsToReserve) || itemsToReserve.length === 0) {
      itemsToReserve = [{ stockItemId: order.stockItemId, quantity: order.quantity }];
    }
    for (const it of itemsToReserve) {
      const sId = parseInt(it.stockItemId, 10);
      const qty = parseFloat(it.quantity || 0);
      if (sId && sId > 0 && qty > 0) {
        const item = await StockItem.findByPk(sId);
        if (item) {
          item.reservedStock = parseFloat(item.reservedStock || 0) + qty;
          await item.save();
        }
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'SaleOrder',
      entityId: order.id,
      details: { orderNo: order.orderNo, customerName: order.customerName, totalAmount: order.totalAmount, currency: order.currency },
      ipAddress
    });

    return order;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const order = await SaleOrder.findByPk(id);
    if (!order) return null;

    const oldData = { status: order.status, totalAmount: order.totalAmount };
    await order.update(data);

    // Release Reserved Stock on Cancellation or Rejection
    if ((data.status === 'Cancelled' || data.status === 'Rejected') && oldData.status !== 'Cancelled' && oldData.status !== 'Rejected' && oldData.status !== 'Completed') {
      let itemsToRelease = [];
      if (order.itemsJson) {
        try { itemsToRelease = JSON.parse(order.itemsJson); } catch (e) { itemsToRelease = []; }
      }
      if (!Array.isArray(itemsToRelease) || itemsToRelease.length === 0) {
        itemsToRelease = [{ stockItemId: order.stockItemId, quantity: order.quantity }];
      }
      for (const it of itemsToRelease) {
        const sId = parseInt(it.stockItemId, 10);
        const qty = parseFloat(it.quantity || 0);
        if (sId && sId > 0 && qty > 0) {
          const item = await StockItem.findByPk(sId);
          if (item) {
            const newReserved = parseFloat(item.reservedStock || 0) - qty;
            item.reservedStock = newReserved < 0 ? 0 : newReserved;
            await item.save();
          }
        }
      }
    }

    // Automatic Stock Decrease & Movement Ledger on Completed (Dispatch) Status
    if (data.status === 'Completed' && oldData.status !== 'Completed') {
      const item = await StockItem.findByPk(order.stockItemId);
      if (item) {
        const newStock = parseFloat(item.currentStock) - parseFloat(order.quantity);
        item.currentStock = newStock < 0 ? 0 : newStock;
        await item.save();

        const { StockMovement } = require('../../models');
        const moveNo = `SH-${Date.now().toString().slice(-6)}`;
        await StockMovement.create({
          movementNo: moveNo,
          stockItemId: item.id,
          sourceWarehouseId: 1,
          movementType: 'Outbound',
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          referenceNo: order.orderNo,
          notes: `[Depodan Sevk] ${order.orderNo} satış siparişi sevk edildi ve stok düşüldü.`,
          performedBy: currentUser ? currentUser.id : null
        });
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'SaleOrder',
      entityId: order.id,
      details: { oldData, newData: data },
      ipAddress
    });

    return order;
  }

  async updateStatus(id, status, currentUser = null, ipAddress = null) {
    return await this.update(id, { status }, currentUser, ipAddress);
  }

  async delete(id, currentUser = null, ipAddress = null) {
    const order = await SaleOrder.findByPk(id);
    if (!order) return false;

    // Release Reserved Stock on Delete if order was active
    if (order.status !== 'Cancelled' && order.status !== 'Rejected' && order.status !== 'Completed') {
      let itemsToRelease = [];
      if (order.itemsJson) {
        try { itemsToRelease = JSON.parse(order.itemsJson); } catch (e) { itemsToRelease = []; }
      }
      if (!Array.isArray(itemsToRelease) || itemsToRelease.length === 0) {
        itemsToRelease = [{ stockItemId: order.stockItemId, quantity: order.quantity }];
      }
      for (const it of itemsToRelease) {
        const sId = parseInt(it.stockItemId, 10);
        const qty = parseFloat(it.quantity || 0);
        if (sId && sId > 0 && qty > 0) {
          const item = await StockItem.findByPk(sId);
          if (item) {
            const newReserved = parseFloat(item.reservedStock || 0) - qty;
            item.reservedStock = newReserved < 0 ? 0 : newReserved;
            await item.save();
          }
        }
      }
    }

    const deletedCode = order.orderNo;
    await order.destroy();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'DELETE',
      entity: 'SaleOrder',
      entityId: id,
      details: { orderNo: deletedCode },
      ipAddress
    });

    return true;
  }

  async getNextOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `SAT-${year}-`;
    const lastOrder = await SaleOrder.findOne({
      where: { orderNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return `${prefix}0001`;

    const parts = lastOrder.orderNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalOrders = await SaleOrder.count();
    const pendingOrders = await SaleOrder.count({ where: { status: 'Pending_Approval' } });
    const completedOrders = await SaleOrder.count({ where: { status: 'Completed' } });

    const totalRevenueResult = await SaleOrder.sum('totalAmount', { where: { status: { [Op.ne]: 'Cancelled' } } });
    const totalRevenue = totalRevenueResult || 0;

    return { totalOrders, pendingOrders, completedOrders, totalRevenue };
  }
}

module.exports = new SaleRepository();
