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
      '/admin',
      '/admin/users',
      '/admin/users/add',
      '/admin/users/1',
      '/admin/roles',
      '/admin/logs'
    ];

    let allOk = true;
    for (const u of urls) {
      const res = await fetch(`http://localhost:${port}${u}`, {
        headers: { Cookie: cookie }
      });
      console.log(`URL [${u.padEnd(20)}] => Status: ${res.status}`);
      if (res.status !== 200) {
        allOk = false;
        const txt = await res.text();
        console.log(`Error output snippet for ${u}:`);
        console.log(txt.slice(0, 1000));
      }
    }

    if (allOk) {
      console.log('✅ ALL REMAINING ADMIN PAGES RETURNED HTTP 200 OK!');
    }

  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
