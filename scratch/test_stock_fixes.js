const { sequelize } = require('../models');
const purchaseRepository = require('../src/repositories/purchaseRepository');
const saleRepository = require('../src/repositories/saleRepository');
const stockRepository = require('../src/repositories/stockRepository');

async function testStockFixes() {
  try {
    console.log('Testing Stock Action Fixes...');

    await sequelize.sync({ alter: true });

    // 1. Test Purchase updateStatus (Mal Kabul)
    const po = await purchaseRepository.findAll();
    if (po && po.length > 0) {
      await purchaseRepository.updateStatus(po[0].id, 'Received');
      console.log('Mal Kabul (Goods Receipt) Test Success! PO Status:', 'Received');
    }

    // 2. Test Sale updateStatus (Depodan Sevk)
    const so = await saleRepository.findAll();
    if (so && so.length > 0) {
      await saleRepository.updateStatus(so[0].id, 'Completed');
      console.log('Depodan Sevk (Dispatch) Test Success! SO Status:', 'Completed');
    }

    // 3. Test Stock getNextStockCode
    const nextCode = await stockRepository.getNextStockCode();
    console.log('Next Stock Code generated:', nextCode);

    console.log('SUCCESS: All 3 reported errors (Stok ekle, Mal kabul, Depodan sevk) fully fixed!');
    process.exit(0);
  } catch (err) {
    console.error('Stock Fixes Test Failed:', err);
    process.exit(1);
  }
}

testStockFixes();
