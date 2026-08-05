const { sequelize, User } = require('../models');
const userRepository = require('../src/repositories/userRepository');

async function testUserUpdate() {
  try {
    console.log('Testing User Management Expansion...');

    await sequelize.sync({ alter: true });
    console.log('DB synced successfully.');

    const admin = await User.findOne({ where: { username: 'admin' } });
    if (!admin) {
      console.error('Admin user not found');
      return;
    }

    const testUser = await userRepository.findByUsername('stok_yoneticisi');
    if (!testUser) {
      console.error('Test user stok_yoneticisi not found');
      return;
    }

    console.log('Original User Details:', {
      id: testUser.id,
      username: testUser.username,
      department: testUser.department,
      title: testUser.title,
      phone: testUser.phone,
      role: testUser.role
    });

    const updatedUser = await userRepository.updateUser(testUser.id, {
      firstName: 'Murat Can',
      lastName: 'Kaya',
      email: 'murat.kaya@enterprise-erp.com',
      phone: '+90 (212) 555 99 88',
      department: 'Depo & Lojistik',
      title: 'Kıdemli Depo Müdürü',
      role: 'Stock_Manager',
      status: 'Active'
    }, admin, '127.0.0.1');

    console.log('Updated User Details:', {
      id: updatedUser.id,
      username: updatedUser.username,
      firstName: updatedUser.firstName,
      department: updatedUser.department,
      title: updatedUser.title,
      phone: updatedUser.phone
    });

    console.log('User update test completed SUCCESSFULLY!');
    process.exit(0);
  } catch (err) {
    console.error('User Update Test Failed:', err);
    process.exit(1);
  }
}

testUserUpdate();
