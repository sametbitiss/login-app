const { sequelize, User } = require('../models');
const stockRepository = require('../src/repositories/stockRepository');

async function testStockCreateSanitize() {
  try {
    console.log('Testing Stock Creation Input Sanitization...');

    await sequelize.sync({ alter: true });

    const admin = await User.findOne({ where: { username: 'admin' } });

    const nextCode = await stockRepository.getNextStockCode();

    // Pass empty strings for integer, decimal and unique fields
    const newItem = await stockRepository.create({
      stockCode: nextCode,
      barcode: '',
      name: 'Test Malzeme Boş String Girdileri',
      description: 'Raf ömrü ve ağırlık boş girildi',
      category: 'Hammadde',
      unit: 'Adet',
      brand: '',
      model: '',
      currentStock: '100',
      minStock: '10',
      maxStock: '',
      purchasePrice: '15.50',
      salePrice: '',
      currency: 'TRY',
      taxRate: '20',
      warehouseLocation: '',
      supplier: '',
      shelfLife: '', // Empty string -> should sanitize to null without PostgreSQL integer error!
      weight: '',    // Empty string -> should sanitize to null
      dimensions: '',
      status: 'Active',
      notes: ''
    }, admin, '127.0.0.1');

    console.log('New Stock Item Created Successfully! ID:', newItem.id, 'Code:', newItem.stockCode);
    console.log('ShelfLife:', newItem.shelfLife, 'Weight:', newItem.weight, 'MaxStock:', newItem.maxStock);

    console.log('SUCCESS: Input sanitization verified! No integer syntax error on empty inputs.');
    process.exit(0);
  } catch (err) {
    console.error('Stock Create Sanitize Test Failed:', err);
    process.exit(1);
  }
}

testStockCreateSanitize();
