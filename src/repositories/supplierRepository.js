const { Supplier, PurchaseOrder, User, StockItem, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class SupplierRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.category) {
      where.category = filters.category;
    }
    if (filters.search) {
      where[Op.or] = [
        { companyName: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { supplierCode: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { taxNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { contactPerson: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await Supplier.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
  }

  async findById(id) {
    return await Supplier.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
  }

  async findByCode(code) {
    return await Supplier.findOne({ where: { supplierCode: code } });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const supplier = await Supplier.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'Supplier',
      entityId: supplier.id,
      details: { supplierCode: supplier.supplierCode, companyName: supplier.companyName },
      ipAddress
    });

    return supplier;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const supplier = await Supplier.findByPk(id);
    if (!supplier) return null;

    const oldData = { companyName: supplier.companyName, status: supplier.status };
    await supplier.update(data);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'Supplier',
      entityId: supplier.id,
      details: { oldData, newData: data },
      ipAddress
    });

    return supplier;
  }

  async getNextCode() {
    const year = new Date().getFullYear();
    const prefix = `TED-${year}-`;
    const last = await Supplier.findOne({
      where: { supplierCode: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });
    if (!last) return `${prefix}0001`;
    const parts = last.supplierCode.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalSuppliers = await Supplier.count();
    const activeSuppliers = await Supplier.count({ where: { status: 'Active' } });
    const avgPerformance = await Supplier.findOne({
      attributes: [[sequelize.fn('AVG', sequelize.col('performanceScore')), 'avgScore']],
      where: { status: 'Active' },
      raw: true
    });
    return {
      totalSuppliers,
      activeSuppliers,
      avgPerformance: avgPerformance ? parseFloat(avgPerformance.avgScore || 0).toFixed(1) : '0.0'
    };
  }

  async getSupplierWithOrders(id) {
    return await Supplier.findByPk(id, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        {
          model: PurchaseOrder, as: 'purchaseOrders',
          include: [{ model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] }],
          order: [['createdAt', 'DESC']],
          limit: 20
        }
      ]
    });
  }
}

module.exports = new SupplierRepository();
