const {
  ProductionOrder,
  BOMItem,
  StockItem,
  StockMovement,
  sequelize
} = require('../../models');

class ProductionService {
  /**
   * Complete work order execution or MES output recording
   * Performs automatic BACKFLUSHING (deducting raw materials) and adding finished goods to stock.
   */
  async recordProductionOutput(orderId, completedQty, scrapQty = 0, currentUser = null) {
    return await sequelize.transaction(async (t) => {
      const order = await ProductionOrder.findByPk(orderId, {
        include: [{ model: StockItem, as: 'stockItem' }],
        transaction: t
      });

      if (!order) {
        throw new Error('İş emri bulunamadı.');
      }

      const additionalCompleted = parseFloat(completedQty) || 0;
      const additionalScrap = parseFloat(scrapQty) || 0;

      const newCompletedTotal = parseFloat(order.completedQuantity) + additionalCompleted;
      const newScrapTotal = parseFloat(order.scrapQuantity) + additionalScrap;

      // 1. Backflush raw materials according to BOM
      const bomItems = await BOMItem.findAll({
        where: { finishedStockItemId: order.stockItemId },
        transaction: t
      });

      for (const bom of bomItems) {
        const scrapMult = 1 + (parseFloat(bom.scrapPercentage || 0) / 100);
        const requiredMaterialQty = parseFloat(bom.quantityRequired) * additionalCompleted * scrapMult;

        const componentItem = await StockItem.findByPk(bom.componentStockItemId, { transaction: t });
        if (componentItem) {
          const oldStock = parseFloat(componentItem.currentStock || 0);
          const newStock = Math.max(0, oldStock - requiredMaterialQty);
          await componentItem.update({ currentStock: newStock }, { transaction: t });

          // Record stock movement (Outbound - Backflushing)
          await StockMovement.create({
            movementNo: `MOV-BF-${Date.now().toString().slice(-6)}`,
            stockItemId: componentItem.id,
            movementType: 'Outbound',
            quantity: requiredMaterialQty,
            unit: componentItem.unit,
            referenceNo: order.workOrderNo,
            notes: `Üretim Düşümü (Backflushing): ${order.workOrderNo} — ${order.productionTitle}`,
            createdBy: currentUser ? currentUser.id : null
          }, { transaction: t });
        }
      }

      // 2. Increase Finished Goods Stock
      const finishedItem = await StockItem.findByPk(order.stockItemId, { transaction: t });
      if (finishedItem) {
        const oldFinishedStock = parseFloat(finishedItem.currentStock || 0);
        await finishedItem.update({ currentStock: oldFinishedStock + additionalCompleted }, { transaction: t });

        // Record stock movement (Inbound - Production Output)
        await StockMovement.create({
          movementNo: `MOV-PRD-${Date.now().toString().slice(-6)}`,
          stockItemId: finishedItem.id,
          movementType: 'Inbound',
          quantity: additionalCompleted,
          unit: finishedItem.unit,
          referenceNo: order.workOrderNo,
          notes: `Üretim Girişi (Mamul): ${order.workOrderNo} — ${order.productionTitle}`,
          createdBy: currentUser ? currentUser.id : null
        }, { transaction: t });
      }

      // 3. Update Production Order Status
      const plannedQty = parseFloat(order.plannedQuantity);
      let newStatus = order.status;
      if (newCompletedTotal >= plannedQty) {
        newStatus = 'Completed';
      } else if (additionalCompleted > 0 && order.status === 'Planned') {
        newStatus = 'In_Production';
      }

      await order.update({
        completedQuantity: newCompletedTotal,
        scrapQuantity: newScrapTotal,
        status: newStatus,
        actualEndDate: newStatus === 'Completed' ? new Date() : order.actualEndDate
      }, { transaction: t });

      return order;
    });
  }
}

module.exports = new ProductionService();
