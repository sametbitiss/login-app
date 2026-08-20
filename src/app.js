const express = require('express');
const path = require('path');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const stockRoutes = require('./routes/stockRoutes');
const saleRoutes = require('./routes/saleRoutes');
const purchaseRoutes = require('./routes/purchaseRoutes');
const productionRoutes = require('./routes/productionRoutes');
const qualityRoutes = require('./routes/qualityRoutes');
const errorHandler = require('./middleware/errorHandler');
const { sequelize } = require('../models');
const seedInitialData = require('./utils/seedData');

const app = express();

// View Engine setup
app.set('views', path.join(__dirname, '../views'));
app.set('view engine', 'ejs');

// Body parsers & Cookie parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static files
app.use(express.static(path.join(__dirname, '../public')));

// Routes
app.use('/', authRoutes);
app.use('/admin', adminRoutes);
app.use('/stock', stockRoutes);
app.use('/sales', saleRoutes);
app.use('/purchase', purchaseRoutes);
app.use('/production', productionRoutes);
app.use('/quality', qualityRoutes);

// Centralized Error Handling Middleware (must be last middleware)
app.use(errorHandler);

// Database Sync and Data Seeding
(async () => {
  try {
    await sequelize.query(`ALTER TABLE "StokKartlari" ADD COLUMN IF NOT EXISTS "tedarikYontemi" VARCHAR(50) DEFAULT 'Satın Alma';`);
    await sequelize.query(`ALTER TABLE "Depolar" ADD COLUMN IF NOT EXISTS "kalemlerJson" TEXT;`);
    await sequelize.query(`ALTER TABLE "SatinAlmaSiparisleri" ADD COLUMN IF NOT EXISTS "teslimDeposu" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "MalKabulleri" ADD COLUMN IF NOT EXISTS "depoLokasyonu" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "teklifTalepTarihi" DATE;`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "teslimYeri" VARCHAR(255);`);
    await sequelize.query(`DO $$ BEGIN CREATE TYPE "public"."enum_StokKartlari_tedarikYontemi" AS ENUM('Satın Alma', 'Üretim', 'Purchase', 'Production'); EXCEPTION WHEN duplicate_object THEN null; END $$;`).catch(() => {});
    await sequelize.query(`ALTER TABLE "StokKartlari" ALTER COLUMN "tedarikYontemi" DROP DEFAULT;`).catch(() => {});
    await sequelize.query(`ALTER TABLE "StokKartlari" ALTER COLUMN "tedarikYontemi" TYPE "public"."enum_StokKartlari_tedarikYontemi" USING ("tedarikYontemi"::"public"."enum_StokKartlari_tedarikYontemi");`).catch(() => {});
    await sequelize.query(`ALTER TABLE "StokKartlari" ALTER COLUMN "tedarikYontemi" SET DEFAULT 'Satın Alma'::"public"."enum_StokKartlari_tedarikYontemi";`).catch(() => {});
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "sevkiyatDurumu" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "kdvDurumu" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "belgeReferansi" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "araToplam" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "toplamIskonto" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "toplamKdv" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "SatinAlmaTeklifTalepleri" ADD COLUMN IF NOT EXISTS "kalemlerVerisi" TEXT;`);
    await sequelize.query(`ALTER TABLE "UrunReceteleri" ADD COLUMN IF NOT EXISTS "versiyon" VARCHAR(50) DEFAULT 'Rev.01';`);
    await sequelize.query(`ALTER TABLE "UrunReceteleri" ADD COLUMN IF NOT EXISTS "bazMiktar" NUMERIC(12,4) DEFAULT 1.0;`);
    await sequelize.query(`ALTER TABLE "UrunReceteleri" ADD COLUMN IF NOT EXISTS "operasyonKodu" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "UrunReceteleri" ADD COLUMN IF NOT EXISTS "seviye" INTEGER DEFAULT 1;`);
    await sequelize.query(`ALTER TABLE "UrunReceteleri" ADD COLUMN IF NOT EXISTS "alternatifBilesenStokId" INTEGER;`);
    await sequelize.query(`ALTER TABLE "UrunReceteleri" ADD COLUMN IF NOT EXISTS "alternatifNotlar" TEXT;`);
    await sequelize.query(`ALTER TABLE "SatisTeklifleri" ADD COLUMN IF NOT EXISTS "ilgiliKisi" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "SatisTeklifleri" ADD COLUMN IF NOT EXISTS "iletisimBilgisi" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "SatisTeklifleri" ADD COLUMN IF NOT EXISTS "faturaAdresi" TEXT;`);
    await sequelize.query(`ALTER TABLE "SatisTeklifleri" ADD COLUMN IF NOT EXISTS "sevkAdresi" TEXT;`);
    await sequelize.query(`ALTER TABLE "SatisTeklifleri" ADD COLUMN IF NOT EXISTS "istenenTerminTarihi" DATE;`);
    await sequelize.query(`ALTER TABLE "SatisTeklifleri" ADD COLUMN IF NOT EXISTS "teslimatSekli" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "Kullanicilar" ADD COLUMN IF NOT EXISTS "dogrulamaKodu" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "Kullanicilar" ADD COLUMN IF NOT EXISTS "dogrulamaKoduSonKullanma" TIMESTAMP WITH TIME ZONE;`);
  } catch (e) {
    console.log('Pre-sync alter table warning:', e.message);
  }

  try {
    await sequelize.sync();
    console.log('Database synced successfully with models.');
    await seedInitialData();
  } catch (err) {
    console.error('Database Sync Error:', err);
  }
})();

module.exports = app;
