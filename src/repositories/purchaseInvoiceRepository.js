const { PurchaseInvoice, PurchaseOrder, Supplier, User } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class PurchaseInvoiceRepository {
  async findAll({ search } = {}) {
    const where = {};
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { invoiceNo: { [Op.iLike || Op.like]: s } },
        { supplierName: { [Op.iLike || Op.like]: s } },
        { orderNo: { [Op.iLike || Op.like]: s } }
      ];
    }

    return await PurchaseInvoice.findAll({
      where,
      include: [
        { model: PurchaseOrder, as: 'purchaseOrder' },
        { model: Supplier, as: 'supplier' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await PurchaseInvoice.findByPk(id, {
      include: [
        { model: PurchaseOrder, as: 'purchaseOrder' },
        { model: Supplier, as: 'supplier' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
  }

  async findByOrderId(purchaseOrderId) {
    return await PurchaseInvoice.findOne({
      where: { purchaseOrderId }
    });
  }

  async findByInvoiceNo(invoiceNo) {
    if (!invoiceNo) return null;
    return await PurchaseInvoice.findOne({
      where: { invoiceNo }
    });
  }

  async getNextInvoiceNo() {
    const invoices = await PurchaseInvoice.findAll({
      attributes: ['invoiceNo'],
      raw: true
    });

    let maxNum = 0;
    const year = new Date().getFullYear();
    const prefix = `SAT-FAT-${year}-`;

    for (const inv of invoices) {
      if (inv.invoiceNo && inv.invoiceNo.startsWith(prefix)) {
        const parts = inv.invoiceNo.split('-');
        const numPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(numPart) && numPart > maxNum) {
          maxNum = numPart;
        }
      }
    }

    let nextNum = maxNum + 1;
    let candidate = `${prefix}${nextNum.toString().padStart(4, '0')}`;

    while (await PurchaseInvoice.findOne({ where: { invoiceNo: candidate } })) {
      nextNum++;
      candidate = `${prefix}${nextNum.toString().padStart(4, '0')}`;
    }

    return candidate;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const invoice = await PurchaseInvoice.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'PurchaseInvoice',
      entityId: invoice.id,
      details: { invoiceNo: invoice.invoiceNo, totalAmount: invoice.totalAmount, supplierName: invoice.supplierName },
      ipAddress
    });

    return invoice;
  }
}

module.exports = new PurchaseInvoiceRepository();
