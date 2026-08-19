const fs = require('fs');
const path = require('path');

function removeSubnavFromContent(content) {
  const lines = content.split('\n');
  const newLines = [];
  let insideSubnav = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.includes('class="module-subnav"') || line.includes("class='module-subnav'")) {
      insideSubnav = true;
      // Also check if comment precedes subnav
      if (newLines.length > 0 && newLines[newLines.length - 1].includes('<!-- Sub-Nav Bar -->')) {
        newLines.pop();
      }
      continue;
    }

    if (insideSubnav) {
      if (line.includes('</div>')) {
        insideSubnav = false;
      }
      continue;
    }

    newLines.push(line);
  }

  return newLines.join('\n');
}

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

let cleanedCount = 0;
ejsFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('module-subnav')) {
    cleanedCount++;
  }
});

console.log(`Files with module-subnav: ${cleanedCount}`);
