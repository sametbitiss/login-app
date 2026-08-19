// Disable Sequelize logging
process.env.NODE_ENV = 'test';
const { sequelize } = require('../models');
if (sequelize) sequelize.options.logging = false;

const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;

  try {
    const resPost = await fetch(`http://localhost:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin123',
      redirect: 'manual'
    });

    const cookie = resPost.headers.get('set-cookie');

    const urls = [
      '/',
      '/admin',
      '/admin/users',
      '/admin/users/add',
      '/admin/users/1',
      '/admin/roles',
      '/admin/settings',
      '/admin/logs',
      '/stock',
      '/sales',
      '/purchase',
      '/production',
      '/quality'
    ];

    let hasError = false;
    for (const u of urls) {
      const res = await fetch(`http://localhost:${port}${u}`, {
        headers: { Cookie: cookie }
      });
      console.log(`URL [${u.padEnd(20)}] => STATUS: ${res.status}`);
      if (res.status !== 200) {
        hasError = true;
        const txt = await res.text();
        console.log(`\n=== ERROR HTML FOR ${u} ===`);
        console.log(txt.slice(0, 1500));
        console.log('===========================\n');
      }
    }

    if (!hasError) {
      console.log('\n✅ ALL ROUTES RETURNED HTTP 200 OK!');
    }

  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
