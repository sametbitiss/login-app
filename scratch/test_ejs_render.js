const ejs = require('ejs');
const path = require('path');
const productionController = require('../src/controllers/productionController');

async function testRender() {
  const req = { user: { id: 1, username: 'admin', role: 'Admin' }, params: {}, query: {} };
  const res = {
    render: (viewPath, data) => {
      const fullPath = path.join(__dirname, '../views', viewPath + '.ejs');
      ejs.renderFile(fullPath, data, (err, str) => {
        if (err) {
          console.error(`EJS Render Error [${viewPath}]:`, err);
        } else {
          console.log(`EJS Render SUCCESS [${viewPath}]! HTML length: ${str.length}`);
        }
      });
    }
  };

  console.log('Testing listBOM render...');
  await productionController.listBOM(req, res, console.error);

  console.log('Testing renderBOMForm render...');
  await productionController.renderBOMForm(req, res, console.error);
}

testRender();
