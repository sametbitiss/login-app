const { GoodsReceipt, PurchaseOrder, User, StockItem, Supplier, StockMovement, sequelize } = require('../../models');
const logService = require('../services/logService');
const { Op } = require('sequelize');

class GoodsReceiptRepository {
  async findAll(filters = {}) {
    const where = {};

    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.qualityStatus) {
      where.qualityStatus = filters.qualityStatus;
    }
    if (filters.search) {
      where[Op.or] = [
        { grnNo: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { deliveryNoteNo: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await GoodsReceipt.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: PurchaseOrder, as: 'purchaseOrder', attributes: ['id', 'orderNo', 'supplierName', 'status'] },
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'supplierCode', 'companyName'] }
      ]
    });
  }

  async findById(id) {
    return await GoodsReceipt.findByPk(id, {
      include: [
        { model: User, as: 'creator' },
        { model: PurchaseOrder, as: 'purchaseOrder' },
        { model: StockItem, as: 'stockItem' },
        { model: Supplier, as: 'supplier' }
      ]
    });
  }

  async create(data, currentUser = null, ipAddress = null) {
    const grn = await GoodsReceipt.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    // Update PurchaseOrder status
    if (data.purchaseOrderId) {
      const po = await PurchaseOrder.findByPk(data.purchaseOrderId);
      if (po) {
        const receivedQty = parseFloat(data.receivedQuantity) || 0;
        const orderedQty = parseFloat(po.quantity) || 0;
        
        // Check total received for this PO
        const totalReceived = await GoodsReceipt.sum('receivedQuantity', {
          where: { purchaseOrderId: data.purchaseOrderId }
        }) || 0;

        if (totalReceived >= orderedQty) {
          await po.update({ status: 'Received' });
        } else {
          await po.update({ status: 'Partial_Received' });
        }
      }
    }

    // If quality approved, update stock
    if (data.qualityStatus === 'Approved') {
      const acceptedQty = parseFloat(data.acceptedQuantity) || parseFloat(data.receivedQuantity) || 0;
      if (acceptedQty > 0 && data.stockItemId) {
        const item = await StockItem.findByPk(data.stockItemId);
        if (item) {
          item.currentStock = parseFloat(item.currentStock) + acceptedQty;
          await item.save();

          const moveNo = `GRN-${Date.now().toString().slice(-6)}`;
          await StockMovement.create({
            movementNo: moveNo,
            stockItemId: item.id,
            targetWarehouseId: 1,
            movementType: 'Inbound',
            quantity: acceptedQty,
            unitPrice: 0,
            referenceNo: data.grnNo,
            notes: `[Mal Kabul] ${data.grnNo} mal kabul fişi ile stok girişi yapıldı.`,
            performedBy: currentUser ? currentUser.id : null
          });
        }
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'GoodsReceipt',
      entityId: grn.id,
      details: { grnNo: grn.grnNo, purchaseOrderId: grn.purchaseOrderId, receivedQuantity: grn.receivedQuantity },
      ipAddress
    });

    return grn;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const grn = await GoodsReceipt.findByPk(id);
    if (!grn) return null;

    await grn.update(data);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'GoodsReceipt',
      entityId: grn.id,
      details: data,
      ipAddress
    });

    return grn;
  }

  async getNextGrnNo() {
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;
    const last = await GoodsReceipt.findOne({
      where: { grnNo: { [Op.like]: `${prefix}%` } },
      order: [['id', 'DESC']]
    });
    if (!last) return `${prefix}0001`;
    const parts = last.grnNo.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }

  async getStats() {
    const totalReceipts = await GoodsReceipt.count();
    const pendingInspection = await GoodsReceipt.count({ where: { qualityStatus: 'Pending_Inspection' } });
    const completedReceipts = await GoodsReceipt.count({ where: { status: 'Completed' } });
    return { totalReceipts, pendingInspection, completedReceipts };
  }
}

module.exports = new GoodsReceiptRepository();
