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
    await sequelize.query(`ALTER TABLE "StockItems" ADD COLUMN IF NOT EXISTS "procurementMethod" VARCHAR(50) DEFAULT 'Satın Alma';`);
    await sequelize.query(`ALTER TABLE "Warehouses" ADD COLUMN IF NOT EXISTS "itemsJson" TEXT;`);
    await sequelize.query(`ALTER TABLE "PurchaseOrders" ADD COLUMN IF NOT EXISTS "deliveryWarehouse" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "GoodsReceipts" ADD COLUMN IF NOT EXISTS "warehouseLocation" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "rfqDate" DATE;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "deliveryPlace" VARCHAR(255);`);
    await sequelize.query(`DO $$ BEGIN CREATE TYPE "public"."enum_StockItems_procurementMethod" AS ENUM('Satın Alma', 'Üretim', 'Purchase', 'Production'); EXCEPTION WHEN duplicate_object THEN null; END $$;`).catch(() => {});
    await sequelize.query(`ALTER TABLE "StockItems" ALTER COLUMN "procurementMethod" DROP DEFAULT;`).catch(() => {});
    await sequelize.query(`ALTER TABLE "StockItems" ALTER COLUMN "procurementMethod" TYPE "public"."enum_StockItems_procurementMethod" USING ("procurementMethod"::"public"."enum_StockItems_procurementMethod");`).catch(() => {});
    await sequelize.query(`ALTER TABLE "StockItems" ALTER COLUMN "procurementMethod" SET DEFAULT 'Satın Alma'::"public"."enum_StockItems_procurementMethod";`).catch(() => {});
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "shippingStatus" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "vatStatus" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "documentRef" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "totalDiscount" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "totalTax" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "itemsData" JSONB;`);
    await sequelize.query(`ALTER TABLE "BOMItems" ADD COLUMN IF NOT EXISTS "version" VARCHAR(50) DEFAULT 'Rev.01';`);
    await sequelize.query(`ALTER TABLE "BOMItems" ADD COLUMN IF NOT EXISTS "baseQuantity" NUMERIC(12,4) DEFAULT 1.0;`);
    await sequelize.query(`ALTER TABLE "BOMItems" ADD COLUMN IF NOT EXISTS "operationCode" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "BOMItems" ADD COLUMN IF NOT EXISTS "level" INTEGER DEFAULT 1;`);
    await sequelize.query(`ALTER TABLE "BOMItems" ADD COLUMN IF NOT EXISTS "alternativeComponentItemId" INTEGER;`);
    await sequelize.query(`ALTER TABLE "BOMItems" ADD COLUMN IF NOT EXISTS "alternativeNotes" TEXT;`);
  } catch (e) {
    console.log('Pre-sync alter table warning:', e.message);
  }

  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced successfully with models.');
    await seedInitialData();
  } catch (err) {
    console.error('Database Sync Error:', err);
  }
})();

module.exports = app;
