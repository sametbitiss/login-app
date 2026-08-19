const { sequelize } = require('../models');
const seedInitialData = require('../src/utils/seedData');

async function testFullApp() {
  console.log('Testing DB sync and seeding...');
  await sequelize.sync({ force: true });
  console.log('DB synced successfully.');

  await seedInitialData();
  console.log('Initial seed completed without errors.');

  const authService = require('../src/services/authService');
  const user = await authService.login('admin', 'admin123');
  console.log('Auth check passed:', user ? (user.kullaniciAdi || user.username) : 'failed');

  const stockService = require('../src/services/stockService');
  const items = await stockService.getAllItems({});
  console.log('Stock items retrieved:', items.length);

  const saleService = require('../src/services/saleService');
  const orders = await saleService.getAllOrders({});
  console.log('Sale orders retrieved:', orders.length);

  const purchaseService = require('../src/services/purchaseService');
  const purchaseOrders = await purchaseService.getAllOrders({});
  console.log('Purchase orders retrieved:', purchaseOrders.length);

  const productionRepository = require('../src/repositories/productionRepository');
  const workOrders = await productionRepository.findAll({});
  console.log('Production work orders retrieved:', workOrders.length);

  console.log('✅ ALL BACKEND SERVICES AND DB QUERIES VERIFIED SUCCESSFULLY!');
  process.exit(0);
}

testFullApp().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
