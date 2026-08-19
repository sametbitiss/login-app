const fs = require('fs');
const path = require('path');

const adminDir = path.join(__dirname, '../views/admin');
const files = fs.readdirSync(adminDir).filter(f => f.endsWith('.ejs') && f !== 'dashboard.ejs');

const dashboardGroup = `      <div class="mss-group-title">📊 KONTROL PANELİ & ANALİTİK</div>
      <div class="mss-sub">
        <a href="/admin" class="mss-sub-link">📊 Yönetim Özeti</a>
      </div>\n\n`;

files.forEach(fileName => {
  const filePath = path.join(adminDir, fileName);
  let content = fs.readFileSync(filePath, 'utf8');

  if (!content.includes('📊 Yönetim Özeti')) {
    const targetStr = '<div class="mss-label">🛡️ SİSTEM YÖNETİMİ & GÜVENLİK</div>\n\n';
    if (content.includes(targetStr)) {
      content = content.replace(targetStr, targetStr + dashboardGroup);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log('Added dashboard group to:', fileName);
    } else {
      const fallbackStr = '<div class="mss-label">🛡️ SİSTEM YÖNETİMİ & GÜVENLİK</div>\n';
      if (content.includes(fallbackStr)) {
        content = content.replace(fallbackStr, fallbackStr + dashboardGroup);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Added dashboard group (fallback) to:', fileName);
      }
    }
  }
});

console.log('Admin sidebars sync completed.');
