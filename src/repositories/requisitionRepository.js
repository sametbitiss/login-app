const { PurchaseRequisition, StockItem, User } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class RequisitionRepository {
  async generateRequisitionNo() {
    const year = new Date().getFullYear();
    const prefix = `TALEP-${year}-`;
    const reqs = await PurchaseRequisition.findAll({
      where: { requisitionNo: { [Op.like]: `${prefix}%` } },
      attributes: ['requisitionNo']
    });

    let maxSeq = 0;
    reqs.forEach(r => {
      const numStr = r.requisitionNo.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;

    while (await PurchaseRequisition.findOne({ where: { requisitionNo: candidate } })) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    return candidate;
  }

  async findAll(filters = {}) {
    const where = {};
    if (filters.sourceModule) where.sourceModule = filters.sourceModule;
    if (filters.status) where.status = filters.status;

    return await PurchaseRequisition.findAll({
      where,
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit', 'purchasePrice', 'currency', 'supplier'] },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async create(reqData, currentUser = null, ipAddress = null) {
    let newReq = null;
    let attempts = 0;

    while (!newReq && attempts < 10) {
      attempts++;
      reqData.requisitionNo = await this.generateRequisitionNo();
      try {
        newReq = await PurchaseRequisition.create({
          ...reqData,
          createdBy: currentUser ? currentUser.id : null,
          requesterName: reqData.requesterName || (currentUser ? (currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username) : 'Sistem')
        });
      } catch (err) {
        if (err.name === 'SequelizeUniqueConstraintError' && attempts < 10) {
          continue;
        }
        throw err;
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE_REQUISITION',
      entity: 'PurchaseRequisition',
      entityId: newReq.id,
      details: { requisitionNo: newReq.requisitionNo, sourceModule: newReq.sourceModule, stockItemId: newReq.stockItemId, requestedQty: newReq.requestedQuantity },
      ipAddress
    });

    return newReq;
  }

  async getNextRequisitionNo() {
    return await this.generateRequisitionNo();
  }

  async updateStatus(id, status, currentUser = null, ipAddress = null) {
    const req = await PurchaseRequisition.findByPk(id);
    if (!req) return null;

    req.status = status;
    await req.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE_REQUISITION_STATUS',
      entity: 'PurchaseRequisition',
      entityId: req.id,
      details: { newStatus: status },
      ipAddress
    });

    return req;
  }
}

module.exports = new RequisitionRepository();
