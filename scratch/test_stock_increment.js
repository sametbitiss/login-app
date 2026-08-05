const { sequelize, User, StockItem, ProductionOrder } = require('../models');
const productionRepository = require('../src/repositories/productionRepository');

async function testStockIncrementOnProductionComplete() {
  try {
    console.log('Testing Automatic Stock Increment on Production Completion...');

    await sequelize.sync({ alter: true });

    const admin = await User.findOne({ where: { username: 'admin' } });
    const stockItem = await StockItem.findOne();

    if (!admin || !stockItem) {
      console.error('Admin or StockItem not found');
      return;
    }

    const initialStock = parseFloat(stockItem.currentStock) || 0;
    console.log('Initial Product Stock:', stockItem.name, '=', initialStock);

    const workOrderNo = await productionRepository.generateWorkOrderNo();

    const order = await productionRepository.create({
      workOrderNo,
      productionTitle: 'Otomatik Stok Artış Test Üretimi',
      stockItemId: stockItem.id,
      plannedQuantity: 50,
      unit: stockItem.unit || 'Adet',
      status: 'In_Production',
      priority: 'Normal',
      workCenter: 'İstasyon-1 (Kesim & Büküm)',
      plannedStartDate: '2026-08-05',
      plannedEndDate: '2026-08-10',
      createdBy: admin.id
    }, admin, '127.0.0.1');

    console.log('Production Order Created in Production:', order.workOrderNo, 'Planned Qty:', order.plannedQuantity);

    // Complete the production order
    await productionRepository.updateStatus(order.id, 'Completed', admin, '127.0.0.1');

    // Reload StockItem from DB
    await stockItem.reload();
    const newStock = parseFloat(stockItem.currentStock) || 0;

    console.log('Updated Product Stock after Completion:', stockItem.name, '=', newStock);
    console.log('Stock Difference:', newStock - initialStock);

    if (newStock === initialStock + 50) {
      console.log('SUCCESS: Production completion automatically increased stock by 50!');
    } else {
      console.error('FAILED: Stock was not updated correctly!');
    }

    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

testStockIncrementOnProductionComplete();
