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

let subnavCount = 0;
ejsFiles.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('module-subnav')) {
    subnavCount++;
    console.log('File with subnav:', path.relative(viewsDir, filePath));
  }
});

console.log(`Total EJS files with module-subnav: ${subnavCount} out of ${ejsFiles.length}`);
