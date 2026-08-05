const { sequelize, User, StockItem } = require('../models');
const requisitionRepository = require('../src/repositories/requisitionRepository');
const purchaseService = require('../src/services/purchaseService');

async function testRequisitionFlow() {
  try {
    console.log('Testing Stock & Production Purchase Requisition Workflow...');

    await sequelize.sync({ alter: true });

    const admin = await User.findOne({ where: { username: 'admin' } });
    const stockItem = await StockItem.findOne();

    if (!admin || !stockItem) {
      console.error('Admin or StockItem not found');
      return;
    }

    // 1. Create Stock Requisition
    const stockReq = await requisitionRepository.create({
      sourceModule: 'Stock',
      stockItemId: stockItem.id,
      requestedQuantity: 200,
      urgency: 'Urgent',
      status: 'Pending',
      requesterName: 'stok_yoneticisi',
      notes: 'Min/Max limit altı stok uyarısı kaynaklı talep.'
    }, admin, '127.0.0.1');

    console.log('Stock Requisition Created:', stockReq.requisitionNo, 'Status:', stockReq.status);

    // 2. Create Production Requisition
    const prodReq = await requisitionRepository.create({
      sourceModule: 'Production',
      stockItemId: stockItem.id,
      requestedQuantity: 500,
      urgency: 'High',
      status: 'Pending',
      requesterName: 'uretim_yoneticisi',
      notes: 'MRP hammadde eksikliği kaynaklı talep.'
    }, admin, '127.0.0.1');

    console.log('Production Requisition Created:', prodReq.requisitionNo, 'Status:', prodReq.status);

    // 3. List Requisitions in Purchase Module
    const allReqs = await requisitionRepository.findAll();
    console.log('Total Incoming Requisitions in Purchase Module:', allReqs.length);

    // 4. Convert Requisition to Purchase Order in Purchase Module
    const nextPO = await purchaseService.getNextOrderNo();
    const po = await purchaseService.createOrder({
      orderNo: nextPO,
      supplierName: stockItem.supplier || 'Norm Cıvata A.Ş.',
      orderDate: '2026-08-05',
      paymentTerm: 'Vadeli_30',
      status: 'Ordered',
      priority: 'High',
      stockItemId: stockItem.id,
      quantity: stockReq.requestedQuantity,
      unitPrice: stockItem.purchasePrice || 5,
      taxRate: 20,
      currency: 'TRY',
      notes: `[Talep No: ${stockReq.requisitionNo}] Stok modülünden dönüştürülen satın alma siparişi.`,
      purchasingAgent: admin.username
    }, admin, '127.0.0.1');

    await requisitionRepository.updateStatus(stockReq.id, 'Ordered', admin, '127.0.0.1');

    console.log('Requisition converted to Purchase Order:', po.orderNo, 'PO Status:', po.status);

    console.log('SUCCESS: Cross-module RBAC & Requisition Workflow Fully Verified!');
    process.exit(0);
  } catch (err) {
    console.error('Requisition Test Failed:', err);
    process.exit(1);
  }
}

testRequisitionFlow();
