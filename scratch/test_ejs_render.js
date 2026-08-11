const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

async function testEjsRender() {
  try {
    console.log('=== TESTING EJS TEMPLATE RENDER FOR rfq_add.ejs ===');

    const templatePath = path.join(__dirname, '../views/purchase/rfq_add.ejs');
    const templateStr = fs.readFileSync(templatePath, 'utf8');

    const mockUser = { id: 1, username: 'admin', firstName: 'Samet', lastName: 'Bitiş', role: 'Admin' };
    const mockSuppliers = [{ id: 1, supplierCode: 'TED-001', companyName: 'Test Tedarikçi A.Ş.' }];
    const mockRequisitionedProducts = [{
      stockItemId: 1,
      stockCode: 'STK-001',
      name: 'Test Ürün',
      category: 'Hammadde',
      unit: 'Adet',
      minStock: 10,
      purchasePrice: 15.5,
      requisitionNo: 'TAL-001',
      requisitionId: 1,
      requestedQuantity: 10
    }];

    const html = ejs.render(templateStr, {
      user: mockUser,
      error: null,
      nextRfqNo: 'TEK-2026-0001',
      suppliers: mockSuppliers,
      requisitionedProducts: mockRequisitionedProducts,
      targetReqId: 1,
      formData: {}
    }, { filename: templatePath });

    console.log('✅ EJS RENDER SUCCESSFUL! Rendered HTML length:', html.length);
  } catch (err) {
    console.error('❌ EJS TEMPLATE ERROR Traceback:', err);
    process.exit(1);
  }
}

testEjsRender();
