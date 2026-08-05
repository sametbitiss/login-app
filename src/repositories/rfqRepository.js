const { PurchaseRfq, User, StockItem, Supplier, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class RfqRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.search) {
      where[Op.or] = [
        { rfqNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { supplierName: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await PurchaseRfq.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'supplierCode', 'companyName'] }
      ]
    });
  }

  async findById(id) {
    return await PurchaseRfq.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: StockItem, as: 'stockItem' },
        { model: Supplier, as: 'supplier' }
      ]
    });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const rfq = await PurchaseRfq.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'PurchaseRfq',
      entityId: rfq.id,
      details: { rfqNo: rfq.rfqNo, supplierName: rfq.supplierName },
      ipAddress
    });

    return rfq;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const rfq = await PurchaseRfq.findByPk(id);
    if (!rfq) return null;

    await rfq.update(data);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'PurchaseRfq',
      entityId: rfq.id,
      details: data,
      ipAddress
    });

    return rfq;
  }

  async getNextRfqNo() {
    const year = new Date().getFullYear();
    const prefix = `RFQ-${year}-`;
    const last = await PurchaseRfq.findOne({
      where: { rfqNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });
    if (!last) return `${prefix}0001`;
    const parts = last.rfqNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalRfqs = await PurchaseRfq.count();
    const pendingRfqs = await PurchaseRfq.count({ where: { status: { [Op.in]: ['Draft', 'Sent'] } } });
    const acceptedRfqs = await PurchaseRfq.count({ where: { status: 'Accepted' } });
    return { totalRfqs, pendingRfqs, acceptedRfqs };
  }
}

module.exports = new RfqRepository();
