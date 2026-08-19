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

    // 2. GET /admin/settings
    const resSettings = await fetch(`http://localhost:${port}/admin/settings`, {
      headers: { Cookie: cookie }
    });
    console.log(`GET /admin/settings -> Status: ${resSettings.status}`);
    const settingsHtml = await resSettings.text();
    const hasUndefinedInputs = settingsHtml.includes('name="undefined"') || settingsHtml.includes('id="undefined"');
    console.log(`Settings HTML has 'undefined' inputs/labels? ${hasUndefinedInputs}`);

    // 3. POST /admin/settings
    const resUpdateSettings = await fetch(`http://localhost:${port}/admin/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body: new URLSearchParams({
        company_name: 'Enterprise ERP Corp',
        system_title: 'Enterprise ERP System',
        maintenance_mode: 'false',
        session_timeout_hours: '8',
        min_password_length: '6',
        max_login_attempts: '5',
        audit_log_retention_days: '90'
      }),
      redirect: 'manual'
    });
    console.log(`POST /admin/settings -> Status: ${resUpdateSettings.status}`);

    // 4. GET /admin/logs
    const resLogs = await fetch(`http://localhost:${port}/admin/logs`, {
      headers: { Cookie: cookie }
    });
    console.log(`GET /admin/logs -> Status: ${resLogs.status}`);
    const logsHtml = await resLogs.text();
    const hasAuditLogItems = logsHtml.includes('Sistem Parametresi') || logsHtml.includes('Kullanıcı Hesabı');
    console.log(`Logs HTML includes formatted audit logs? ${hasAuditLogItems}`);

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
