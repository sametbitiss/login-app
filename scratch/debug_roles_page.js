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

    const resRoles = await fetch(`http://localhost:${port}/admin/roles`, {
      headers: { Cookie: cookie }
    });

    console.log(`GET /admin/roles -> Status: ${resRoles.status}`);
    const text = await resRoles.text();
    if (resRoles.status === 200) {
      console.log('Roles page rendered successfully with HTTP 200!');
      console.log('Contains "Rol & Modül Yetki Yapılandırması":', text.includes('Rol &amp; Modül Yetki Yapılandırması') || text.includes('Rol & Modül Yetki Yapılandırması'));
      console.log('Contains "Sekme 1: Departman & Rol Yönetimi":', text.includes('Sekme 1: Departman &amp; Rol Yönetimi') || text.includes('Sekme 1: Departman & Rol Yönetimi'));
    } else {
      console.log('ERROR STATUS:', resRoles.status);
      console.log(text.slice(0, 1000));
    }

  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
