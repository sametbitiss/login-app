const jwt = require('jsonwebtoken');
const app = require('../src/app');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-erp-system-2026';
const token = jwt.sign({ id: 1, username: 'admin', role: 'Admin' }, JWT_SECRET, { expiresIn: '1h' });

const server = app.listen(3016, async () => {
  const req = http.request({
    hostname: 'localhost',
    port: 3016,
    path: '/production/bom',
    method: 'GET',
    headers: { 'Cookie': `token=${token}` }
  }, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log('Status Code:', res.statusCode);
      console.log('Body:', body);
      server.close(() => process.exit(0));
    });
  });
  req.end();
});
