const { Kullanici, sequelize } = require('../models');

async function cleanDummyUsers() {
  console.log('Cleaning dummy test users from veritabanı...');

  // 1. Find the admin user
  const adminUser = await Kullanici.findOne({ where: { kullaniciAdi: 'admin' } });
  if (!adminUser) {
    console.error('Admin user not found!');
    process.exit(1);
  }

  // 2. Re-assign any foreign key references to admin user ID if needed
  await sequelize.query(`UPDATE "StokKartlari" SET "olusturanId" = ${adminUser.id} WHERE "olusturanId" != ${adminUser.id};`).catch(() => {});
  await sequelize.query(`UPDATE "SatisSiparisleri" SET "olusturanId" = ${adminUser.id} WHERE "olusturanId" != ${adminUser.id};`).catch(() => {});
  await sequelize.query(`UPDATE "SatinAlmaSiparisleri" SET "olusturanId" = ${adminUser.id} WHERE "olusturanId" != ${adminUser.id};`).catch(() => {});
  await sequelize.query(`UPDATE "UretimEmirleri" SET "olusturanId" = ${adminUser.id} WHERE "olusturanId" != ${adminUser.id};`).catch(() => {});
  await sequelize.query(`UPDATE "DenetimKayitlari" SET "kullaniciId" = ${adminUser.id} WHERE "kullaniciId" != ${adminUser.id};`).catch(() => {});

  // 3. Delete all users except admin
  const deletedCount = await Kullanici.destroy({
    where: {
      kullaniciAdi: { [sequelize.Sequelize.Op.ne]: 'admin' }
    }
  });

  console.log(`Deleted ${deletedCount} dummy test user(s).`);

  const remainingUsers = await Kullanici.findAll();
  console.log(`Remaining users in database (${remainingUsers.length}):`);
  remainingUsers.forEach(u => console.log(` - ID ${u.id}: ${u.kullaniciAdi} (${u.ad} ${u.soyad}) - ${u.rol}`));

  process.exit(0);
}

cleanDummyUsers().catch(err => {
  console.error('Error cleaning dummy users:', err);
  process.exit(1);
});
