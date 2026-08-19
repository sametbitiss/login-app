const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Server started on port ${port}`);

  try {
    // 1. Perform login
    const resPost = await fetch(`http://localhost:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin123',
      redirect: 'manual'
    });

    const cookie = resPost.headers.get('set-cookie');
    console.log('Login cookie received:', !!cookie);

    const pagesToTest = ['/admin', '/admin/users', '/stock/items', '/sales/orders', '/purchase/orders', '/production/orders', '/quality/dashboard'];

    for (const pagePath of pagesToTest) {
      const res = await fetch(`http://localhost:${port}${pagePath}`, {
        headers: { Cookie: cookie },
        redirect: 'follow'
      });
      console.log(`GET ${pagePath} -> Final URL: ${res.url}, Status: ${res.status}`);
      const html = await res.text();

      const hasTopBar = html.includes('module-topbar');
      const hasSubNavDiv = html.includes('<div class="module-subnav">') || html.includes("<div class='module-subnav'>");
      const hasSidebarScript = html.includes('/sidebar.js');
      const hasMssGroupTitle = html.includes('mss-group-title');

      console.log(`  TopBar: ${hasTopBar}, SubNavDiv: ${hasSubNavDiv}, SidebarScript: ${hasSidebarScript}, MssGroupTitle: ${hasMssGroupTitle}`);
    }

  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
