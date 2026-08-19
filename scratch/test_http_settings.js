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

    const res = await fetch(`http://localhost:${port}/admin/settings`, {
      headers: { Cookie: cookie }
    });

    console.log(`GET /admin/settings Status: ${res.status}`);
    const text = await res.text();
    if (res.status !== 200) {
      console.log('Error output:');
      console.log(text.slice(0, 1500));
    } else {
      console.log('✅ Success! Rendered length:', text.length);
    }

  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
