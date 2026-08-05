const { SaleQuotation, StockItem, CustomerAccount, User } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class QuotationRepository {
  async findAll({ search, status } = {}) {
    const where = {};
    if (status && status !== '') where.status = status;
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { quotationNo: { [Op.iLike]: s } },
        { customerName: { [Op.iLike]: s } }
      ];
    }

    return await SaleQuotation.findAll({
      where,
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: CustomerAccount, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SaleQuotation.findByPk(id, {
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: CustomerAccount, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
  }

  async getNextQuotationNo() {
    const last = await SaleQuotation.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'TEK-2026-0001';
    const num = last.id + 1;
    return `TEK-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    // Check if approval needed (>20% discount or >100,000 TL total)
    const discountRate = parseFloat(data.discountRate) || 0;
    const totalAmount = parseFloat(data.totalAmount) || 0;
    const approvalNeeded = discountRate > 20 || totalAmount > 100000;

    const quotation = await SaleQuotation.create({
      ...data,
      approvalNeeded,
      status: approvalNeeded ? 'Pending_Approval' : (data.status || 'Draft'),
      createdBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'SaleQuotation',
      entityId: quotation.id,
      details: { quotationNo: quotation.quotationNo, customerName: quotation.customerName },
      ipAddress
    });

    return quotation;
  }

  async updateStatus(id, status, managerNotes = null, currentUser = null, ipAddress = null) {
    const quote = await SaleQuotation.findByPk(id);
    if (!quote) return null;

    quote.status = status;
    if (managerNotes) quote.managerNotes = managerNotes;
    await quote.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE_STATUS',
      entity: 'SaleQuotation',
      entityId: quote.id,
      details: { status, managerNotes },
      ipAddress
    });

    return quote;
  }
}

module.exports = new QuotationRepository();
