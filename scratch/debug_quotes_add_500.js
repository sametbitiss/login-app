const saleController = require('../src/controllers/saleController');

async function debug() {
  const req = {
    user: { id: 1, username: 'admin', role: 'Admin' },
    query: {}
  };

  const res = {
    render: (view, data) => console.log('RENDER OK:', view),
    redirect: (url) => console.log('REDIRECT:', url)
  };

  try {
    await saleController.renderAddQuotation(req, res);
  } catch (err) {
    console.error('EXACT CONTROLLER ERROR:', err);
  }
}

debug();
