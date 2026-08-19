const { Kullanici } = require('../models');

async function checkUsers() {
  const users = await Kullanici.findAll();
  console.log(`Total users in database: ${users.length}`);
  users.forEach(u => {
    console.log(`ID: ${u.id}, kullaniciAdi: ${u.kullaniciAdi}, ad: ${u.ad}, soyad: ${u.soyad}, eposta: ${u.eposta}, rol: ${u.rol}, durum: ${u.durum}`);
  });
  process.exit(0);
}

checkUsers().catch(err => {
  console.error(err);
  process.exit(1);
});
