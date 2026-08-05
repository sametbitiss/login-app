const { SaleInvoice, SaleOrder, SaleDispatchNote, CustomerAccount, User } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');
const customerRepository = require('./customerRepository');

class InvoiceRepository {
  async findAll({ search } = {}) {
    const where = {};
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { invoiceNo: { [Op.iLike]: s } },
        { customerName: { [Op.iLike]: s } }
      ];
    }

    return await SaleInvoice.findAll({
      where,
      include: [
        { model: SaleOrder, as: 'saleOrder' },
        { model: SaleDispatchNote, as: 'dispatchNote' },
        { model: CustomerAccount, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SaleInvoice.findByPk(id, {
      include: [
        { model: SaleOrder, as: 'saleOrder' },
        { model: SaleDispatchNote, as: 'dispatchNote' },
        { model: CustomerAccount, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
  }

  async getNextInvoiceNo() {
    const last = await SaleInvoice.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'FAT-2026-0001';
    const num = last.id + 1;
    return `FAT-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const invoice = await SaleInvoice.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    // Update customer account balance if customer ID is present
    if (data.customerId) {
      await customerRepository.updateBalance(data.customerId, data.totalAmount);
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'SaleInvoice',
      entityId: invoice.id,
      details: { invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount },
      ipAddress
    });

    return invoice;
  }
}

module.exports = new InvoiceRepository();
