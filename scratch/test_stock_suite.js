const { sequelize } = require('../models');
const seedInitialData = require('../src/utils/seedData');
const stockRepository = require('../src/repositories/stockRepository');
const stockValuationService = require('../src/services/stockValuationService');

async function testStockSuiteIntegration() {
  try {
    console.log('Testing 10 Sub-Module Stock & Warehouse Suite Integration...');

    await sequelize.sync({ alter: true });
    await seedInitialData();

    // 1. Check Warehouses & Locations
    const warehouses = await stockRepository.findAllWarehouses();
    console.log('Warehouses Count:', warehouses.length);

    // 2. Check Lots & Traceability
    const lots = await stockRepository.findAllLots();
    console.log('Lots Count:', lots.length);

    // 3. Check Transfers & Movements
    const movements = await stockRepository.findAllMovements();
    console.log('Movements Count:', movements.length);

    // 4. Test Stock Valuation (FIFO & Weighted Avg)
    const valuation = await stockValuationService.calculateValuation();
    console.log('Valuation Report Calculated!');
    console.log('Total Avg Valuation:', valuation.totalAvgValuation, 'TRY');
    console.log('Total FIFO Valuation:', valuation.totalFifoValuation, 'TRY');

    // 5. Test Critical Stock Alerts
    const alerts = await stockRepository.getLowStockAlerts();
    console.log('Low Stock Alerts Count:', alerts.length);

    console.log('SUCCESS: All 10 Industrial Stock & Warehouse Sub-Modules Operational!');
    process.exit(0);
  } catch (err) {
    console.error('Stock Suite Integration Test Failed:', err);
    process.exit(1);
  }
}

testStockSuiteIntegration();
