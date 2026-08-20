const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;

  try {
    // 1. Login as Admin
    const resPost = await fetch(`http://localhost:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin123',
      redirect: 'manual'
    });

    const cookie = resPost.headers.get('set-cookie');

    // 2. GET /sales/quotes/add
    const resGet = await fetch(`http://localhost:${port}/sales/quotes/add`, {
      headers: { Cookie: cookie }
    });

    console.log(`GET /sales/quotes/add Status: ${resGet.status}`);
    const html = await resGet.text();

    const checks = [
      'productSelectModal',
      'modalProductSearch',
      'modalProductSort',
      'openProductSelectModal',
      'renderModalProducts',
      'addSelectedProductsToQuote'
    ];

    let allChecksPassed = true;
    for (const c of checks) {
      const exists = html.includes(c);
      console.log(`Check [${c.padEnd(28)}] => ${exists ? '✅ PASSED' : '❌ FAILED'}`);
      if (!exists) allChecksPassed = false;
    }

    if (allChecksPassed && resGet.status === 200) {
      console.log('✅ ALL SALES QUOTATION MODAL CHECKS PASSED!');
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
