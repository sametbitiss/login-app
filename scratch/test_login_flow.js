const app = require('../src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log(`Server started on port ${port}`);

  try {
    const resGet = await fetch(`http://localhost:${port}/login`);
    console.log('GET /login status:', resGet.status);
    const htmlGet = await resGet.text();
    console.log('GET /login page title:', htmlGet.match(/<title>(.*?)<\/title>/)?.[1]);

    const resPost = await fetch(`http://localhost:${port}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'username=admin&password=admin123',
      redirect: 'manual'
    });

    console.log('POST /login status:', resPost.status);
    console.log('POST /login headers location:', resPost.headers.get('location'));
    console.log('POST /login set-cookie:', resPost.headers.get('set-cookie'));

    if (resPost.status !== 302 && resPost.status !== 200) {
      console.log('POST /login response text:', await resPost.text());
    } else if (resPost.status === 200) {
      const text = await resPost.text();
      console.log('POST /login 200 text snippet:', text.slice(0, 500));
    }

    // Now test navigating to '/' with the cookie!
    const cookie = resPost.headers.get('set-cookie');
    if (cookie) {
      const resHome = await fetch(`http://localhost:${port}/`, {
        headers: { Cookie: cookie },
        redirect: 'manual'
      });
      console.log('GET / with cookie status:', resHome.status);
      if (resHome.status !== 200) {
        console.log('GET / text:', await resHome.text());
      }
    }
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    server.close();
    process.exit(0);
  }
});
