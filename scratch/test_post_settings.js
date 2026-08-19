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

    // 2. Submit Settings Form
    const resUpdate = await fetch(`http://localhost:${port}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body: new URLSearchParams({
        company_name: 'Enterprise ERP Corporation',
        system_title: 'Enterprise ERP',
        maintenance_mode: 'false',
        session_timeout_hours: '12',
        min_password_length: '6',
        max_login_attempts: '5',
        audit_log_retention_days: '90'
      }),
      redirect: 'manual'
    });

    console.log(`POST /admin/settings Status: ${resUpdate.status}`);
    if (resUpdate.status === 302) {
      console.log('✅ SUCCESS! Saved settings and redirected to /admin/settings?success=...');
    } else {
      const txt = await resUpdate.text();
      console.log('Error snippet:');
      console.log(txt.slice(0, 1000));
    }

  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
