const jwt = require('jsonwebtoken');
const { User } = require('../models');

async function testIndexActive() {
  const admin = await User.findOne({ where: { username: 'admin' } });
  const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-erp-system-2026';
  const token = jwt.sign(
    { id: admin.id, username: admin.username, role: admin.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  const res = await fetch('http://localhost:3002/', {
    headers: { Cookie: `token=${token}` }
  });

  const html = await res.text();
  console.log('GET / Index Status:', res.status);
  console.log('Index HTML Contains Active Quality Card?', html.includes('id="card-quality"') && html.includes('/quality'));
  console.log('Index HTML Contains Pasif Kalite?', html.includes('ŞİMDİLİK PASİF'));
  process.exit(0);
}

setTimeout(testIndexActive, 1000);
