const { User, StockItem, Warehouse, StockMovement, GoodsReceipt, PurchaseOrder } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');
const stockValuationService = require('../src/services/stockValuationService');

async function testStock() {
  try {
    console.log('Testing stockRepository.findAll()...');
    const items = await stockRepository.findAll();
    console.log('Items count:', items.length);

    console.log('Testing stockRepository.getStats()...');
    const stats = await stockRepository.getStats();
    console.log('Stats:', stats);

    console.log('Testing stockRepository.findAllWarehouses()...');
    const warehouses = await stockRepository.findAllWarehouses();
    console.log('Warehouses count:', warehouses.length);

    console.log('Testing stockRepository.getLowStockAlerts()...');
    const alerts = await stockRepository.getLowStockAlerts();
    console.log('Alerts count:', alerts.length);

    console.log('Testing stockValuationService.calculateValuation()...');
    const valuation = await stockValuationService.calculateValuation();
    console.log('Valuation success, totalValue:', valuation.totalValue);

    console.log('Testing stockRepository.findAllMovements()...');
    const movements = await stockRepository.findAllMovements();
    console.log('Movements count:', movements.length);

    console.log('ALL STOCK DB CALLS SUCCESSFUL!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR in stock backend:', err);
    process.exit(1);
  }
}

testStock();
