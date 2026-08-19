const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Server started on port ${port}`);

  try {
    const resPost = await fetch(`http://localhost:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin123',
      redirect: 'manual'
    });

    const cookie = resPost.headers.get('set-cookie');
    console.log('Login cookie received:', !!cookie);

    const adminUrls = [
      `http://localhost:${port}/admin`,
      `http://localhost:${port}/admin/dashboard`,
      `http://localhost:${port}/admin/users`,
      `http://localhost:${port}/admin/roles`,
      `http://localhost:${port}/admin/settings`,
      `http://localhost:${port}/admin/logs`
    ];

    for (const url of adminUrls) {
      const res = await fetch(url, { headers: { Cookie: cookie }, redirect: 'manual' });
      console.log(`GET ${url} -> Status: ${res.status}`);
      const text = await res.text();
      if (url.endsWith('/admin') || url.endsWith('/admin/dashboard')) {
        console.log('  Contains "Sistem Yönetimi & Güvenlik Özeti":', text.includes('Sistem Yönetimi & Güvenlik Özeti'));
        console.log('  Contains "deptChart":', text.includes('deptChart'));
        console.log('  Contains "roleChart":', text.includes('roleChart'));
      }
    }

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
