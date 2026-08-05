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

    // Mark associated SaleOrder as Shipped/Completed
    const saleOrder = await SaleOrder.findByPk(data.saleOrderId);
    if (saleOrder) {
      saleOrder.status = 'Completed';
      saleOrder.fulfillmentStatus = 'Closed';
      await saleOrder.save();

      // Trigger automatic stock decrease
      const { StockItem, StockMovement } = require('../../models');
      const item = await StockItem.findByPk(saleOrder.stockItemId);
      if (item) {
        const newStock = parseFloat(item.currentStock) - parseFloat(saleOrder.quantity);
        item.currentStock = newStock < 0 ? 0 : newStock;
        await item.save();

        await StockMovement.create({
          movementNo: `SH-${Date.now().toString().slice(-6)}`,
          stockItemId: item.id,
          sourceWarehouseId: 1,
          movementType: 'Outbound',
          quantity: saleOrder.quantity,
          unitPrice: saleOrder.unitPrice,
          referenceNo: dispatch.dispatchNo,
          notes: `[İrsaliyeli Sevkiyat] ${dispatch.dispatchNo} sevk irsaliyesi ile depodan çıkış yapıldı.`,
          performedBy: currentUser ? currentUser.id : null
        });
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'CREATE',
      entity: 'SaleDispatchNote',
      entityId: dispatch.id,
      details: { dispatchNo: dispatch.dispatchNo },
      ipAddress
    });

    return dispatch;
  }
}

module.exports = new DispatchRepository();
