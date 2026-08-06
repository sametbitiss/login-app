const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function testAdminLinks() {
  const admin = await User.findOne({ where: { username: 'admin' } });
  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-erp-system-2026';
  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const urls = [
    'http://localhost:3002/admin',
    'http://localhost:3002/admin/users',
    'http://localhost:3002/admin/users/add',
    'http://localhost:3002/admin/roles',
    'http://localhost:3002/admin/settings'
  ];

  console.log('Testing Admin Module Routes...');
  let passCount = 0;
  for (const url of urls) {
    const res = await fetch(url, { headers: { Cookie: `token=${token}` } });
    if (res.status === 200) {
      console.log(`✅ [200 OK] ${url}`);
      passCount++;
    } else {
      console.error(`❌ [${res.status}] ${url}`);
    }
  }

  // Also verify that /admin HTML contains the dashboard title
  const dashRes = await fetch('http://localhost:3002/admin', { headers: { Cookie: `token=${token}` } });
  const dashHtml = await dashRes.text();
  if (dashHtml.includes('Kurumsal Sistem Yönetim Özeti') && dashHtml.includes('exec-kpi-grid')) {
    console.log('✅ /admin page verified rendering Real Executive Summary Dashboard!');
  } else {
    console.error('❌ /admin page failed content check!');
  }

  process.exit(passCount === urls.length ? 0 : 1);
}

setTimeout(testAdminLinks, 2000);
