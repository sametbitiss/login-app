const ejs = require('ejs');
const path = require('path');
const userRepository = require('../src/repositories/userRepository');

async function testEjsRender() {
  try {
    const settings = await userRepository.getAllSettings();
    const filePath = path.join(__dirname, '../views/admin/settings.ejs');

    const user = { username: 'admin', role: 'Admin', firstName: 'Admin', lastName: 'User' };
    const html = await ejs.renderFile(filePath, { user, settings, successMessage: null });
    console.log('✅ EJS RENDER SUCCESS! Rendered HTML length:', html.length);
  } catch (err) {
    console.error('❌ EJS RENDER ERROR:', err);
  } finally {
    process.exit(0);
  }
}

testEjsRender();
