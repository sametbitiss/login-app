const { PurchaseOrder, User, StockItem, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class PurchaseRepository {
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
        { supplierName: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { supplierTaxNo: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await PurchaseOrder.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit', 'currentStock'] }
      ]
    });
  }

  async findById(id) {
    return await PurchaseOrder.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem' }
      ]
    });
  }

  async findByOrderNo(orderNo) {
    return await PurchaseOrder.findOne({ where: { orderNo } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const order = await PurchaseOrder.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'PurchaseOrder',
      entityId: order.id,
      details: { orderNo: order.orderNo, supplierName: order.supplierName, totalAmount: order.totalAmount, currency: order.currency },
      ipAddress
    });

    return order;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const order = await PurchaseOrder.findByPk(id);
    if (!order) return null;

    const oldData = { status: order.status, totalAmount: order.totalAmount };
    await order.update(data);

    // Automatic Stock Increase & Movement Ledger on Received Status
    if (data.status === 'Received' && oldData.status !== 'Received') {
      const item = await StockItem.findByPk(order.stockItemId);
      if (item) {
        item.currentStock = parseFloat(item.currentStock) + parseFloat(order.quantity);
        await item.save();

        const { StockMovement } = require('../../models');
        const moveNo = `SH-${Date.now().toString().slice(-6)}`;
        await StockMovement.create({
          movementNo: moveNo,
          stockItemId: item.id,
          targetWarehouseId: 1,
          movementType: 'Inbound',
          quantity: order.quantity,
          unitPrice: order.unitPrice,
          referenceNo: order.orderNo,
          notes: `[Mal Kabul] ${order.orderNo} satın alma siparişi depoya alındı ve stok güncellendi.`,
          performedBy: currentUser ? currentUser.id : null
        });
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'PurchaseOrder',
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
    const order = await PurchaseOrder.findByPk(id);
    if (!order) return false;

    const deletedCode = order.orderNo;
    await order.destroy();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'DELETE',
      entity: 'PurchaseOrder',
      entityId: id,
      details: { orderNo: deletedCode },
      ipAddress
    });

    return true;
  }

  async getNextOrderNo() {
    const year = new Date().getFullYear();
    const prefix = `SATIN-${year}-`;
    const lastOrder = await PurchaseOrder.findOne({
      where: { orderNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastOrder) return `${prefix}0001`;

    const parts = lastOrder.orderNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalOrders = await PurchaseOrder.count();
    const pendingOrders = await PurchaseOrder.count({ where: { status: 'Pending_Approval' } });
    const receivedOrders = await PurchaseOrder.count({ where: { status: 'Received' } });

    const totalSpendResult = await PurchaseOrder.sum('totalAmount', { where: { status: { [Op.ne]: 'Cancelled' } } });
    const totalSpend = totalSpendResult || 0;

    return { totalOrders, pendingOrders, receivedOrders, totalSpend };
  }
}

module.exports = new PurchaseRepository();
