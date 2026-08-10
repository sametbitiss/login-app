const { CustomerAccount, User, SaleOrder } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class CustomerRepository {
  async findAll({ search, status } = {}) {
    const where = {};
    if (status && status !== '') where.status = status;
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { customerCode: { [Op.iLike]: s } },
        { companyName: { [Op.iLike]: s } },
        { contactPerson: { [Op.iLike]: s } },
        { email: { [Op.iLike]: s } },
        { phone: { [Op.iLike]: s } }
      ];
    }

    return await CustomerAccount.findAll({
      where,
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    const validId = parseInt(id, 10);
    if (!validId || Number.isNaN(validId) || validId <= 0) return null;
    return await CustomerAccount.findByPk(validId, {
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: SaleOrder, as: 'orders' }
      ]
    });
  }

  async getNextCustomerCode() {
    const last = await CustomerAccount.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'CAR-2026-0001';
    const num = last.id + 1;
    return `CAR-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const customer = await CustomerAccount.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'CustomerAccount',
      entityId: customer.id,
      details: { customerCode: customer.customerCode, companyName: customer.companyName },
      ipAddress
    });

    return customer;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const customer = await CustomerAccount.findByPk(id);
    if (!customer) return null;

    await customer.update(data);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'CustomerAccount',
      entityId: customer.id,
      details: data,
      ipAddress
    });

    return customer;
  }

  async updateBalance(id, amountToAdd) {
    const customer = await CustomerAccount.findByPk(id);
    if (customer) {
      customer.currentBalance = parseFloat(customer.currentBalance) + parseFloat(amountToAdd);
      await customer.save();
    }
  }
}

module.exports = new CustomerRepository();
