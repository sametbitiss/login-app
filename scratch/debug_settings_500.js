const adminController = require('../src/controllers/adminController');

async function testRenderSettings() {
  const req = {
    user: { id: 1, username: 'admin', role: 'Admin', firstName: 'Admin', lastName: 'User' },
    query: {}
  };

  const res = {
    render: (view, data) => console.log('RENDER SUCCESS:', view, Object.keys(data)),
    redirect: (url) => console.log('REDIRECT:', url)
  };

  try {
    await adminController.renderSettings(req, res);
    console.log('SUCCESS!');
  } catch (err) {
    console.error('EXACT CONTROLLER ERROR ON SETTINGS:', err);
  }
}

testRenderSettings();
