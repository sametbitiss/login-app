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

    // Test POST /admin/users/add with a new valid user
    const addBody = new URLSearchParams({
      username: 'yeni_personel',
      password: 'password123',
      email: 'yeni.personel@enterprise-erp.com',
      firstName: 'Mehmet',
      lastName: 'Kaya',
      phone: '+90 (555) 987 65 43',
      department: 'Sistem Yönetimi',
      title: 'BT Destek Sorumlusu',
      role: 'Employee'
    });

    const resAdd = await fetch(`http://localhost:${port}/admin/users/add`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        Cookie: cookie
      },
      body: addBody,
      redirect: 'manual'
    });

    console.log(`POST /admin/users/add -> Status: ${resAdd.status}`);
    if (resAdd.status !== 302 && resAdd.status !== 200) {
      const text = await resAdd.text();
      console.log('Error Body:', text.slice(0, 1000));
    } else {
      console.log('Success! Redirect Location:', resAdd.headers.get('location'));
    }

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
