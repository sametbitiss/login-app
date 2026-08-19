const fs = require('fs');
const path = require('path');

function getFiles(dir, files = []) {
  const fileList = fs.readdirSync(dir);
  for (const file of fileList) {
    const name = path.join(dir, file);
    if (fs.statSync(name).isDirectory()) {
      getFiles(name, files);
    } else if (name.endsWith('.ejs')) {
      files.push(name);
    }
  }
  return files;
}

const viewsDir = path.join(__dirname, '../views');
const ejsFiles = getFiles(viewsDir);

ejsFiles.forEach(filePath => {
  const relPath = path.relative(viewsDir, filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  // Search for quick cards or inner card grids with hrefs inside page content
  const matches = content.match(/<a\s+href=["']\/(admin|stock|sales|purchase|production|quality)[^"']*["']/g);
  
  if (matches && matches.length > 0) {
    // Exclude topbar links (header.module-topbar) and sidebar links (aside.module-sidebar)
    const lines = content.split('\n');
    let inSidebar = false;
    let inTopbar = false;
    let contentLinks = [];

    lines.forEach((line, idx) => {
      if (line.includes('<aside') || line.includes('class="module-sidebar"')) inSidebar = true;
      if (line.includes('</aside>')) inSidebar = false;
      if (line.includes('<header') || line.includes('class="module-topbar"')) inTopbar = true;
      if (line.includes('</header>')) inTopbar = false;

      if (!inSidebar && !inTopbar) {
        if (line.match(/<a\s+href=["']\/(admin|stock|sales|purchase|production|quality)[^"']*["']/)) {
          contentLinks.push(`Line ${idx + 1}: ${line.trim()}`);
        }
      }
    });

    if (contentLinks.length > 0) {
      console.log(`=== File: ${relPath} (${contentLinks.length} inner content links) ===`);
      contentLinks.slice(0, 5).forEach(l => console.log('  ', l));
    }
  }
});
