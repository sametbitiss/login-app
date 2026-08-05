const { PurchaseRequisition, StockItem, User } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class RequisitionRepository {
  async generateRequisitionNo() {
    const year = new Date().getFullYear();
    const prefix = `TALEP-${year}-`;
    const lastReq = await PurchaseRequisition.findOne({
      where: { requisitionNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });

    if (!lastReq) return `${prefix}0001`;

    const lastNo = lastReq.requisitionNo.replace(prefix, '');
    const nextSeq = parseInt(lastNo, 10) + 1;
    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
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
    if (!reqData.requisitionNo) {
      reqData.requisitionNo = await this.generateRequisitionNo();
    }

    const newReq = await PurchaseRequisition.create({
      ...reqData,
      createdBy: currentUser ? currentUser.id : null,
      requesterName: reqData.requesterName || (currentUser ? currentUser.username : 'Sistem')
    });

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
