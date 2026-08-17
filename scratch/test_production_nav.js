const jwt = require('jsonwebtoken');
const app = require('../src/app');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-erp-system-2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });

const server = app.listen(3010, async () => {
  console.log('Test server running on port 3010');

  const routes = [
    '/production/analytics',
    '/production/requisitions',
    '/production/orders',
    '/production/orders/add',
    '/production/mrp',
    '/production/bom',
    '/production/routing',
    '/production/capacity',
    '/production/mes'
  ];

  let failed = false;

  for (const route of routes) {
    await new Promise((resolve) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3010,
        path: route,
        method: 'GET',
        headers: {
          'Cookie': `token=${token}`
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          const hasReqSubnav = body.includes('href="/production/requisitions" class="msn-link');
          const hasReqSidebar = body.includes('href="/production/requisitions" class="mss-sub-link');
          console.log(`GET ${route} -> Status ${res.statusCode} | Subnav Link: ${hasReqSubnav} | Sidebar Link: ${hasReqSidebar}`);
          if (res.statusCode >= 400 || !hasReqSubnav || !hasReqSidebar) {
            console.error(`FAILED verification for ${route}`);
            failed = true;
          }
          resolve();
        });
      });
      req.on('error', (err) => {
        console.error(`Request error for ${route}:`, err.message);
        failed = true;
        resolve();
      });
      req.end();
    });
  }

  server.close(() => {
    if (failed) {
      console.error('Production navigation test failed!');
      process.exit(1);
    } else {
      console.log('All production navigation links verified successfully!');
      process.exit(0);
    }
  });
});
