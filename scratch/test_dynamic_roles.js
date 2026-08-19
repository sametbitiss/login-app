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

    // 2. GET /admin/roles
    const resRoles = await fetch(`http://localhost:${port}/admin/roles`, {
      headers: { Cookie: cookie }
    });
    console.log(`1. GET /admin/roles -> Status: ${resRoles.status}`);
    const textRoles = await resRoles.text();
    console.log('Contains Tab 1:', textRoles.includes('Sekme 1: Departman &amp; Rol Yönetimi') || textRoles.includes('Sekme 1: Departman & Rol Yönetimi'));
    console.log('Contains Tab 2:', textRoles.includes('Sekme 2: Rol Bazlı Yetki Yapılandırma'));

    // 3. POST /admin/roles/create (Create new custom role)
    const createBody = new URLSearchParams({
      label: 'Saha Satış Temsilcisi',
      department: 'Satış & Pazarlama Direktörlüğü',
      description: 'Müşteri ziyaretleri yapan saha satış uzmanı'
    });

    const resCreate = await fetch(`http://localhost:${port}/admin/roles/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie
      },
      body: createBody,
      redirect: 'manual'
    });
    console.log(`2. POST /admin/roles/create -> Status: ${resCreate.status}`);
    console.log('Redirect Location:', resCreate.headers.get('location'));

    // 4. Check if new role appears in Add User page dropdown
    const resAddUser = await fetch(`http://localhost:${port}/admin/users/add`, {
      headers: { Cookie: cookie }
    });
    const textAddUser = await resAddUser.text();
    console.log('Contains "Saha Satış Temsilcisi" in Add User dropdown:', textAddUser.includes('Saha Satış Temsilcisi'));

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
