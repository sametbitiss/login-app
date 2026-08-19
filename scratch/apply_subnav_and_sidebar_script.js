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

let updatedFilesCount = 0;

ejsFiles.forEach(filePath => {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // 1. Remove <div class="module-subnav">...</div> blocks line by line
  if (content.includes('module-subnav')) {
    const lines = content.split('\n');
    const newLines = [];
    let insideSubnav = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('class="module-subnav"') || line.includes("class='module-subnav'")) {
        insideSubnav = true;
        // Remove preceding comment if present
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

    content = newLines.join('\n');
    modified = true;
  }

  // 2. Inject <script src="/sidebar.js" defer></script> into head if not already present
  if (content.includes('</head>') && !content.includes('/sidebar.js')) {
    content = content.replace('</head>', '  <script src="/sidebar.js" defer></script>\n</head>');
    modified = true;
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    updatedFilesCount++;
  }
});

console.log(`Successfully updated ${updatedFilesCount} EJS view files.`);
