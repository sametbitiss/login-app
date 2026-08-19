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

    // Test GET /admin/roles
    const resRoles = await fetch(`http://localhost:${port}/admin/roles`, {
      headers: { Cookie: cookie }
    });

    console.log(`GET /admin/roles -> Status: ${resRoles.status}`);
    const text = await resRoles.text();
    if (resRoles.status === 200) {
      console.log('Roles Matrix page loaded successfully!');
      console.log('Contains "Sistem Yönetimi & Güvenlik":', text.includes('Sistem Yönetimi &amp; Güvenlik') || text.includes('Sistem Yönetimi & Güvenlik'));
      console.log('Contains "Stok Kartları Listesi":', text.includes('Stok Kartları Listesi'));
      console.log('Contains "Giriş, Proses ve Final Muayeneleri":', text.includes('Giriş, Proses ve Final Muayeneleri'));
      console.log('Contains "40 İzin Aktif":', text.includes('40 İzin Aktif'));
    } else {
      console.log('Error output:', text.slice(0, 1000));
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
