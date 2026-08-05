const { sequelize, User, StockItem, ProductionOrder } = require('../models');
const productionRepository = require('../src/repositories/productionRepository');

async function testProductionModule() {
  try {
    console.log('Testing Production Planning Module Integration...');

    await sequelize.sync({ alter: true });
    console.log('DB synced successfully.');

    const admin = await User.findOne({ where: { username: 'admin' } });
    const stockItem = await StockItem.findOne();

    if (!admin || !stockItem) {
      console.error('Admin or StockItem not found for testing');
      return;
    }

    const workOrderNo = await productionRepository.generateWorkOrderNo();
    console.log('Generated Work Order No:', workOrderNo);

    const newOrder = await productionRepository.create({
      workOrderNo,
      productionTitle: 'Elektrik Kumanda Panosu Montajı',
      stockItemId: stockItem.id,
      plannedQuantity: 20,
      unit: 'Adet',
      status: 'Planned',
      priority: 'Urgent',
      workCenter: 'İstasyon-5 (Montaj & Test)',
      plannedStartDate: '2026-08-05',
      plannedEndDate: '2026-08-12',
      estimatedHours: 16.0,
      productionManager: 'Oğuz Aydın',
      bomNotes: '1x Klemens Kutusu, 5x Kablo Bağı',
      notes: 'Test amaçlı üretim iş emri',
      createdBy: admin.id
    }, admin, '127.0.0.1');

    console.log('Test Production Order Created:', {
      id: newOrder.id,
      workOrderNo: newOrder.workOrderNo,
      title: newOrder.productionTitle,
      status: newOrder.status,
      priority: newOrder.priority
    });

    const updated = await productionRepository.updateStatus(newOrder.id, 'In_Production', admin, '127.0.0.1');
    console.log('Status updated to In_Production:', updated.status, 'Actual Start Date:', updated.actualStartDate);

    const stats = await productionRepository.getStats();
    console.log('Production Stats:', stats);

    console.log('Production Module Integration Test completed SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('Production Module Test Failed:', err);
    process.exit(1);
  }
}

testProductionModule();
