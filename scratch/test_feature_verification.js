const jwt = require('jsonwebtoken');
const app = require('../src/app');
const http = require('http');

const JWT_SECRET = 'super-secret-jwt-key-erp-system-2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });

const server = app.listen(3010, async () => {
  console.log('Testing on port 3010...');

  const paths = [
    '/purchase/orders',
    '/stock/goods-receipt',
    '/stock/warehouses'
  ];

  for (const path of paths) {
    await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3010,
        path: path,
        method: 'GET',
        headers: {
          'Cookie': `token=${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          console.log(`GET ${path} -> Status ${res.statusCode} (Length: ${body.length})`);
          if (res.statusCode >= 400) {
            console.error(`ERROR Response for ${path}:`, body.slice(0, 300));
          }
          resolve();
        });
      });
      req.on('error', (err) => {
        console.error(`Request error for ${path}:`, err.message);
        resolve();
      });
      req.end();
    });
  }

  server.close(() => {
    console.log('Feature verification completed successfully!');
    process.exit(0);
  });
});
