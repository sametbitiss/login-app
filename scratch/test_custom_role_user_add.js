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

    // 2. Create custom role
    await fetch(`http://localhost:${port}/admin/roles/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body: 'label=Özel+Saha+Uzmanı&department=Satış+Yönetimi&description=Test'
    });

    // 3. Add user with this new custom role
    const addUserBody = new URLSearchParams({
      username: 'saha_uzmani_test_ok',
      password: 'password123',
      email: 'saha_ok@enterprise-erp.com',
      firstName: 'Saha',
      lastName: 'Uzmanı',
      phone: '+90 (555) 123 45 67',
      department: 'Satış Yönetimi',
      role: 'Ozel_Saha_Uzmani'
    });

    const resAdd = await fetch(`http://localhost:${port}/admin/users/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body: addUserBody,
      redirect: 'manual'
    });

    console.log(`POST /admin/users/add with Custom Role -> Status: ${resAdd.status}`);
    if (resAdd.status === 302) {
      console.log('✅ SUCCESS! User created and redirected to /admin/users!');
    } else {
      const text = await resAdd.text();
      console.log('Error page text snippet:');
      console.log(text.slice(0, 1000));
    }

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
