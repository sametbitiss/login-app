const adminController = require('../src/controllers/adminController');

async function testAddUser() {
  const req = {
    user: { id: 1, username: 'admin', role: 'Admin' },
    ip: '127.0.0.1',
    body: {
      username: 'test_user_debug',
      password: 'password123',
      email: 'debug_user@test.com',
      firstName: 'Debug',
      lastName: 'User',
      phone: '+90 (555) 000 00 00',
      department: 'Satış Yönetimi',
      role: 'Ozel_Saha_Uzmani'
    }
  };

  const res = {
    redirect: (url) => console.log('Redirected to:', url),
    render: (view, data) => console.log('Rendered view:', view, data)
  };

  try {
    await adminController.addUser(req, res);
    console.log('SUCCESS!');
  } catch (err) {
    console.error('EXACT CONTROLLER ERROR:', err);
  }
}

testAddUser();
