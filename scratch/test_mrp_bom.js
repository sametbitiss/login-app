const { sequelize } = require('../models');
const seedInitialData = require('../src/utils/seedData');
const mrpService = require('../src/services/mrpService');
const productionRepository = require('../src/repositories/productionRepository');

async function testMRPAndBOMIntegration() {
  try {
    console.log('Testing MRP, BOM, Routing & Capacity Integration...');

    await sequelize.sync({ alter: true });
    await seedInitialData();

    // 1. Check BOM Items
    const boms = await productionRepository.findAllBOM();
    console.log('BOM Items Count:', boms.length);

    // 2. Check Routings
    const routings = await productionRepository.findAllRoutings();
    console.log('Routings Count:', routings.length);

    // 3. Test MRP Calculation
    const mrpData = await mrpService.calculateMRP();
    console.log('MRP Calculation Completed!');
    console.log('Active Orders Count:', mrpData.activeOrdersCount);
    console.log('Shortage Items Count:', mrpData.totalShortageItems);
    console.log('Requisition Cost:', mrpData.totalRequisitionCost);

    // 4. Test Capacity Load Calculation
    const capacity = await mrpService.calculateCapacityLoad();
    console.log('Capacity Load Report Completed!');
    console.log('Stations Tracked:', capacity.length);
    capacity.forEach(c => {
      console.log(`- ${c.workCenter}: ${c.loadPercentage}% Load (${c.statusLabel})`);
    });

    console.log('SUCCESS: All MRP, BOM, Routing & Capacity Engines Operational!');
    process.exit(0);
  } catch (err) {
    console.error('Integration Test Failed:', err);
    process.exit(1);
  }
}

testMRPAndBOMIntegration();
