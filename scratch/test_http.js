const http = require('http');

function checkRoute(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3002${path}`, (res) => {
      console.log(`Path: ${path} => Status: ${res.statusCode}`);
      resolve(res.statusCode);
    }).on('error', (err) => {
      console.error(`Path: ${path} => Error: ${err.message}`);
      reject(err);
    });
  });
}

async function testHttp() {
  try {
    await checkRoute('/stock');
    await checkRoute('/stock/analytics');
    await checkRoute('/stock/items');
    await checkRoute('/stock/warehouses');
    process.exit(0);
  } catch (err) {
    process.exit(1);
  }
}

testHttp();
