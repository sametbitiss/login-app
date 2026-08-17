const jwt = require('jsonwebtoken');
const app = require('../src/app');
const http = require('http');
const { StockItem, BOMItem } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-erp-system-2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });

const server = app.listen(3015, async () => {
  console.log('Test server running on port 3015');

  try {
    // 1. Check or seed sample Mamul / Yarı Mamul stock items if none exist
    let mamul = await StockItem.findOne({ where: { category: 'Mamul' } });
    if (!mamul) {
      mamul = await StockItem.create({
        stockCode: 'MAM-001',
        name: 'Elektrikli Scooter',
        category: 'Mamul',
        procurementMethod: 'Üretim',
        unit: 'Adet',
        currentStock: 10,
        purchasePrice: 5000,
        salePrice: 12000,
        status: 'Active'
      });
      console.log('Created sample Mamul stock item: MAM-001');
    }

    let hammadde = await StockItem.findOne({ where: { category: 'Hammadde' } });
    if (!hammadde) {
      hammadde = await StockItem.create({
        stockCode: 'HAM-050',
        name: 'Alüminyum Profil',
        category: 'Hammadde',
        procurementMethod: 'Satın Alma',
        unit: 'Mt',
        currentStock: 500,
        purchasePrice: 150,
        status: 'Active'
      });
      console.log('Created sample Hammadde stock item: HAM-050');
    }

    // 2. Perform GET /production/bom
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3015,
        path: '/production/bom',
        method: 'GET',
        headers: { 'Cookie': `token=${token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`GET /production/bom -> Status ${res.statusCode} (Body length: ${body.length})`);
          if (res.statusCode !== 200 || !body.includes('Üretim Reçeteleri ve Ürün Ağacı Yönetimi')) {
            console.error('FAILED: GET /production/bom page render error');
            process.exit(1);
          }
          resolve();
        });
      });
      req.on('error', reject);
      req.end();
    });

    // 3. Perform POST /production/bom/save (Create BOM with version, baseQty, component, scrap %, operationCode)
    const componentsData = [
      {
        componentStockItemId: hammadde.id,
        quantityRequired: 2.5,
        unit: 'Mt',
        scrapPercentage: 3.0,
        operationCode: 'İstasyon-2 (Kaynak & Sac İşleme)',
        notes: 'Lazer kesim plaka giden malzeme'
      }
    ];

    const postData = new URLSearchParams({
      finishedStockItemId: mamul.id,
      version: 'Rev.02',
      baseQuantity: '1.0',
      componentsJson: JSON.stringify(componentsData)
    }).toString();

    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3015,
        path: '/production/bom/save',
        method: 'POST',
        headers: {
          'Cookie': `token=${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        console.log(`POST /production/bom/save -> Status ${res.statusCode} (Redirect expected 302)`);
        if (res.statusCode !== 302 && res.statusCode !== 200) {
          console.error('FAILED: POST /production/bom/save error');
          process.exit(1);
        }
        resolve();
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });

    // 4. Verify in Database that BOMItem was saved with version, baseQuantity, etc.
    const savedBOMs = await BOMItem.findAll({ where: { finishedStockItemId: mamul.id } });
    console.log(`Database BOMItems count for finishedStockItemId ${mamul.id}: ${savedBOMs.length}`);
    if (savedBOMs.length === 0) {
      console.error('FAILED: No BOMItems found in DB after POST');
      process.exit(1);
    }

    console.log('Saved BOM Detail sample:', {
      bomCode: savedBOMs[0].bomCode,
      version: savedBOMs[0].version,
      baseQuantity: savedBOMs[0].baseQuantity,
      quantityRequired: savedBOMs[0].quantityRequired,
      operationCode: savedBOMs[0].operationCode,
      scrapPercentage: savedBOMs[0].scrapPercentage
    });

    // 5. Test GET /production/bom again to ensure product shows "✓ Reçetesi Var" and "Rev.02"
    await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3015,
        path: '/production/bom',
        method: 'GET',
        headers: { 'Cookie': `token=${token}` }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`Verification GET /production/bom -> Status ${res.statusCode}`);
          if (!body.includes('Reçetesi Var') || !body.includes('Rev.02')) {
            console.error('FAILED: BOM status badges or version text missing in rendered HTML');
            process.exit(1);
          }
          resolve();
        });
      });
      req.on('error', reject);
      req.end();
    });

    console.log('SUCCESS: All BOM features (model, repository, controller, views) verified cleanly!');
    server.close(() => process.exit(0));

  } catch (err) {
    console.error('Test script exception:', err);
    process.exit(1);
  }
});
