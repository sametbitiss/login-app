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

  async getReceiptsByOrderId(orderId) {
    return await GoodsReceipt.findAll({
      where: { purchaseOrderId: orderId },
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
        { model: Supplier, as: 'supplier', attributes: ['id', 'supplierCode', 'companyName'] }
      ]
    });
  }

  async getReceivedTotalsForOrder(orderId) {
    const receipts = await GoodsReceipt.findAll({
      where: { purchaseOrderId: orderId }
    });

    const receivedMap = {};
    receipts.forEach(gr => {
      let items = [];
      if (gr.itemsData) {
        try {
          items = typeof gr.itemsData === 'string' ? JSON.parse(gr.itemsData) : gr.itemsData;
        } catch (e) { items = []; }
      }

      if (Array.isArray(items) && items.length > 0) {
        items.forEach(it => {
          const sId = parseInt(it.stockItemId, 10);
          const qty = parseFloat(it.currentReceivedQuantity || it.receivedQuantity || 0);
          if (sId) {
            receivedMap[sId] = (receivedMap[sId] || 0) + qty;
          }
        });
      } else if (gr.stockItemId) {
        const sId = parseInt(gr.stockItemId, 10);
        const qty = parseFloat(gr.receivedQuantity || 0);
        if (sId) {
          receivedMap[sId] = (receivedMap[sId] || 0) + qty;
        }
      }
    });

    return receivedMap;
  }

  async getNextGrnNo() {
    const year = new Date().getFullYear();
    const prefix = `GRN-${year}-`;
    const receipts = await GoodsReceipt.findAll({
      where: { grnNo: { [Op.like]: `${prefix}%` } },
      attributes: ['grnNo']
    });

    let maxSeq = 0;
    receipts.forEach(r => {
      const numStr = r.grnNo.replace(prefix, '');
      const num = parseInt(numStr, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    });

    let nextSeq = maxSeq + 1;
    let candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    while (await GoodsReceipt.findOne({ where: { grnNo: candidate } })) {
      nextSeq++;
      candidate = `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }
    return candidate;
  }

  async getStats() {
    const totalReceipts = await GoodsReceipt.count();
    const pendingInspection = await GoodsReceipt.count({ where: { qualityStatus: 'Pending_Inspection' } });
    const completedReceipts = await GoodsReceipt.count({ where: { status: 'Completed' } });
    return { totalReceipts, pendingInspection, completedReceipts };
  }
}

module.exports = new GoodsReceiptRepository();
