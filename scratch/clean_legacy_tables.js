const { Sequelize, QueryTypes } = require('sequelize');
const config = require('../config/config.json').development;
const seq = new Sequelize(config.database, config.username, config.password, {
  host: config.host,
  dialect: config.dialect,
  logging: false
});

const turkishTables = new Set([
  'DenetimKayitlari', 'Depolar', 'DovizKurlari', 'KaliteDoflari', 'KaliteDokumanlari',
  'KaliteEkipmanlari', 'KaliteMuayeneleri', 'KaliteUygunsuzluklari', 'Kullanicilar',
  'MalKabulleri', 'MusteriCariHareketleri', 'MusteriFiyatListeleri', 'MusteriHesaplari',
  'RotaOperasyonlari', 'SatinAlmaFaturalari', 'SatinAlmaSiparisleri', 'SatinAlmaTalepleri',
  'SatinAlmaTeklifTalepleri', 'SatisFaturalari', 'SatisIrsaliyeleri', 'SatisSiparisleri',
  'SatisTeklifleri', 'SistemAyarlari', 'StokHareketleri', 'StokKartlari', 'StokLokasyonlari',
  'StokPartileri', 'StokSayimlari', 'Tedarikciler', 'UretimEmirleri', 'UrunReceteleri', 'SequelizeMeta'
]);

async function clean() {
  const rows = await seq.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    { type: QueryTypes.SELECT }
  );

  const allTables = rows.map(r => (Array.isArray(r) ? r[0] : (r.table_name || r)));
  console.log('Currently found tables:', allTables.length);

  for (const name of allTables) {
    if (name && !turkishTables.has(name)) {
      console.log('Dropping legacy table:', name);
      await seq.query(`DROP TABLE IF EXISTS "${name}" CASCADE;`);
    }
  }

  const remainingRows = await seq.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    { type: QueryTypes.SELECT }
  );
  const remainingTables = remainingRows.map(r => (Array.isArray(r) ? r[0] : (r.table_name || r)));
  console.log('Remaining active Turkish tables count in DB:', remainingTables.length);
  console.log(remainingTables);
}

clean().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
