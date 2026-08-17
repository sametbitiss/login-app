const productionController = require('../src/controllers/productionController');

async function test() {
  const req = { user: { id: 1, username: 'admin', role: 'Admin' } };
  const res = {
    render: (view, data) => {
      console.log('Render view success:', view);
      console.log('Keys in rendered data:', Object.keys(data));
      console.log('Product BOM List length:', data.productBOMList.length);
    }
  };
  try {
    await productionController.listBOM(req, res, (err) => {
      if (err) console.error('Error passed to next():', err);
    });
  } catch (err) {
    console.error('Direct Exception:', err);
  }
}

test();
