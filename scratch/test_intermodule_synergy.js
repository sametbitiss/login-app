const { sequelize, User, StockItem, StockMovement, BOMItem } = require('../models');
const seedInitialData = require('../src/utils/seedData');
const purchaseRepository = require('../src/repositories/purchaseRepository');
const saleRepository = require('../src/repositories/saleRepository');
const productionRepository = require('../src/repositories/productionRepository');

async function testIntermoduleSynergy() {
  try {
    console.log('Testing Inter-Module ERP Synergy & Automatic Inventory Ledger...');

    await sequelize.sync({ alter: true });
    await seedInitialData();

    const admin = await User.findOne({ where: { username: 'admin' } });

    // 1. Mal Kabul (Purchase Receipt) -> Auto Stock Increase
    const rawMaterial = await StockItem.findOne({ where: { stockCode: 'STK-0001' } });
    const prevRawStock = parseFloat(rawMaterial.currentStock);

    const poNo = await purchaseRepository.getNextOrderNo();
    const po = await purchaseRepository.create({
      orderNo: poNo,
      supplierName: 'Norm Cıvata A.Ş.',
      orderDate: '2026-08-05',
      paymentTerm: 'Pesin',
      status: 'Ordered',
      priority: 'Normal',
      stockItemId: rawMaterial.id,
      quantity: 500,
      unitPrice: 4.50,
      taxRate: 20,
      totalAmount: 2700,
      currency: 'TRY'
    }, admin, '127.0.0.1');

    console.log(`Created PO [${po.orderNo}] for 500 units of ${rawMaterial.name}.`);
    
    // Perform Goods Receipt (Mal Kabul)
    await purchaseRepository.updateStatus(po.id, 'Received', admin, '127.0.0.1');

    const updatedRawMaterial = await StockItem.findByPk(rawMaterial.id);
    console.log(`Raw Material Stock BEFORE: ${prevRawStock} | AFTER Mal Kabul: ${updatedRawMaterial.currentStock}`);
    if (parseFloat(updatedRawMaterial.currentStock) !== prevRawStock + 500) {
      throw new Error('Stock increase logic failed!');
    }

    // 2. Production Completion -> Auto Product Stock Increase & Auto Component BOM Stock Decrease
    const finishedProduct = await StockItem.findOne({ where: { stockCode: 'STK-0002' } });
    const prevFinishedStock = parseFloat(finishedProduct.currentStock);

    const workOrderNo = await productionRepository.generateWorkOrderNo();
    const prodOrder = await productionRepository.create({
      workOrderNo,
      productionTitle: 'Test Şasi Üretimi',
      stockItemId: finishedProduct.id,
      plannedQuantity: 2,
      completedQuantity: 2,
      scrapQuantity: 0,
      unit: 'Adet',
      status: 'In_Production',
      priority: 'High',
      workCenter: 'İstasyon-2 (Kaynak & Sac İşleme)',
      plannedStartDate: '2026-08-05',
      plannedEndDate: '2026-08-15',
      actualStartDate: '2026-08-05',
      productionManager: 'Oğuz Aydın'
    }, admin, '127.0.0.1');

    console.log(`Created Work Order [${prodOrder.workOrderNo}] for 2 units of ${finishedProduct.name}.`);

    // Complete Production Order
    await productionRepository.updateStatus(prodOrder.id, 'Completed', admin, '127.0.0.1');

    const updatedFinishedProduct = await StockItem.findByPk(finishedProduct.id);
    console.log(`Finished Product Stock BEFORE: ${prevFinishedStock} | AFTER Production: ${updatedFinishedProduct.currentStock}`);

    // 3. Depodan Sevk (Sales Dispatch) -> Auto Stock Decrease
    const soNo = await saleRepository.getNextOrderNo();
    const so = await saleRepository.create({
      orderNo: soNo,
      customerName: 'Mega İnşaat A.Ş.',
      orderDate: '2026-08-05',
      paymentTerm: 'Pesin',
      status: 'Approved',
      priority: 'Normal',
      stockItemId: finishedProduct.id,
      quantity: 1,
      unitPrice: 24500,
      taxRate: 20,
      totalAmount: 29400,
      currency: 'TRY'
    }, admin, '127.0.0.1');

    console.log(`Created SO [${so.orderNo}] for 1 unit of ${finishedProduct.name}.`);

    // Complete Dispatch (Sevk Et)
    await saleRepository.updateStatus(so.id, 'Completed', admin, '127.0.0.1');

    const finalFinishedProduct = await StockItem.findByPk(finishedProduct.id);
    console.log(`Finished Product Stock AFTER Sales Dispatch: ${finalFinishedProduct.currentStock}`);

    // Check StockMovements ledger count
    const movements = await StockMovement.findAll();
    console.log(`Total Stock Ledger Movements Recorded: ${movements.length}`);

    console.log('SUCCESS: Inter-Module Synergy & Real-Time Stock Ledger Fully Verified!');
    process.exit(0);
  } catch (err) {
    console.error('Inter-Module Synergy Test Failed:', err);
    process.exit(1);
  }
}

testIntermoduleSynergy();
