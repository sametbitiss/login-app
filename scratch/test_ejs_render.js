const ejs = require('ejs');
const path = require('path');
const productionController = require('../src/controllers/productionController');

async function testRender() {
  const req = { user: { id: 1, username: 'admin', role: 'Admin' } };
  const res = {
    render: (viewPath, data) => {
      const fullPath = path.join(__dirname, '../views', viewPath + '.ejs');
      ejs.renderFile(fullPath, data, (err, str) => {
        if (err) {
          console.error('EJS Render Error:', err);
        } else {
          console.log('EJS Render SUCCESS! HTML length:', str.length);
        }
      });
    }
  };
  await productionController.listBOM(req, res, console.error);
}

testRender();
