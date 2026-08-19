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

    // 1. GET /admin/roles
    const resRoles = await fetch(`http://localhost:${port}/admin/roles`, { headers: { Cookie: cookie } });
    console.log(`GET /admin/roles -> Status: ${resRoles.status}`);
    const textRoles = await resRoles.text();
    const roleCardMatches = (textRoles.match(/class="role-item-card"/g) || []).length;
    console.log(`Total role cards rendered on /admin/roles page: ${roleCardMatches}`);

    // 2. GET /admin/users/add
    const resAddUser = await fetch(`http://localhost:${port}/admin/users/add`, { headers: { Cookie: cookie } });
    console.log(`GET /admin/users/add -> Status: ${resAddUser.status}`);
    const textAddUser = await resAddUser.text();
    console.log('Add User includes "Stok & Depo Yönetimi":', textAddUser.includes('Stok & Depo Yönetimi'));

    // 3. GET /admin/users/1
    const resUserDetail = await fetch(`http://localhost:${port}/admin/users/1`, { headers: { Cookie: cookie } });
    console.log(`GET /admin/users/1 -> Status: ${resUserDetail.status}`);
    const textUserDetail = await resUserDetail.text();
    console.log('User Detail includes "Sistem Yönetimi & Güvenlik":', textUserDetail.includes('Sistem Yönetimi & Güvenlik'));

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
