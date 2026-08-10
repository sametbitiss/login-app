const { SaleDispatchNote, SaleOrder, CustomerAccount, StockItem, User } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class DispatchRepository {
  async findAll({ search } = {}) {
    const where = {};
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { dispatchNo: { [Op.iLike]: s } },
        { customerName: { [Op.iLike]: s } },
        { vehiclePlate: { [Op.iLike]: s } },
        { trackingNo: { [Op.iLike]: s } }
      ];
    }

    return await SaleDispatchNote.findAll({
      where,
      include: [
        { model: SaleOrder, as: 'saleOrder', include: [{ model: StockItem, as: 'stockItem' }] },
        { model: CustomerAccount, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    return await SaleDispatchNote.findByPk(id, {
      include: [
        { model: SaleOrder, as: 'saleOrder', include: [{ model: StockItem, as: 'stockItem' }] },
        { model: CustomerAccount, as: 'customer' },
        { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }
      ]
    });
  }

  async getNextDispatchNo() {
    const last = await SaleDispatchNote.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'IRS-2026-0001';
    const num = last.id + 1;
    return `IRS-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const dispatch = await SaleDispatchNote.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });

    // Mark associated SaleOrder as Completed
    const saleOrder = await SaleOrder.findByPk(data.saleOrderId);
    if (saleOrder) {
      saleOrder.status = 'Completed';
      saleOrder.fulfillmentStatus = 'Closed';
      await saleOrder.save();

      // Parse items to deduct from stock
      let itemsToDeduct = [];
      if (data.itemsJson) {
        try {
          itemsToDeduct = typeof data.itemsJson === 'string' ? JSON.parse(data.itemsJson) : data.itemsJson;
        } catch (e) {
          itemsToDeduct = [];
        }
      }

      if (!Array.isArray(itemsToDeduct) || itemsToDeduct.length === 0) {
        itemsToDeduct = [{
          stockItemId: saleOrder.stockItemId,
          dispatchQuantity: saleOrder.quantity,
          unitPrice: saleOrder.unitPrice
        }];
      }

      const { StockItem, StockMovement } = require('../../models');

      for (const it of itemsToDeduct) {
        const sId = parseInt(it.stockItemId, 10);
        const qtyToDeduct = parseFloat(it.dispatchQuantity || it.quantity || 1);
        if (sId && sId > 0 && qtyToDeduct > 0) {
          const item = await StockItem.findByPk(sId);
          if (item) {
            const newStock = parseFloat(item.currentStock) - qtyToDeduct;
            item.currentStock = newStock < 0 ? 0 : newStock;
            await item.save();

            await StockMovement.create({
              movementNo: `SH-${Date.now().toString().slice(-6)}-${sId}`,
              stockItemId: item.id,
              sourceWarehouseId: 1,
              movementType: 'Outbound',
              quantity: qtyToDeduct,
              unitPrice: it.unitPrice || item.salePrice || 0,
              referenceNo: dispatch.dispatchNo,
              notes: `[İrsaliyeli Sevkiyat] ${dispatch.dispatchNo} sevk irsaliyesi ile ${item.name} (${qtyToDeduct} Adet) depodan çıkış yapıldı.`,
              performedBy: currentUser ? currentUser.id : null
            });
          }
        }
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'SaleDispatchNote',
      entityId: dispatch.id,
      details: { dispatchNo: dispatch.dispatchNo, saleOrderId: dispatch.saleOrderId, customerName: dispatch.customerName },
      ipAddress
    });

    return dispatch;
  }
}

module.exports = new DispatchRepository();
