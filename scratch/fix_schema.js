const { sequelize } = require('../models');

async function fixSchema() {
  try {
    console.log('Adding itemsJson column to Warehouses...');
    await sequelize.query(`ALTER TABLE "Warehouses" ADD COLUMN IF NOT EXISTS "itemsJson" TEXT;`);
    
    // Check other possible missing columns in app.js:
    await sequelize.query(`ALTER TABLE "StockItems" ADD COLUMN IF NOT EXISTS "procurementMethod" VARCHAR(50) DEFAULT 'Satın Alma';`);
    await sequelize.query(`ALTER TABLE "PurchaseOrders" ADD COLUMN IF NOT EXISTS "deliveryWarehouse" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "GoodsReceipts" ADD COLUMN IF NOT EXISTS "warehouseLocation" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "rfqDate" DATE;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "deliveryPlace" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "shippingStatus" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "vatStatus" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "documentRef" VARCHAR(255);`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "subtotal" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "totalDiscount" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "totalTax" NUMERIC(15,4) DEFAULT 0;`);
    await sequelize.query(`ALTER TABLE "PurchaseRfqs" ADD COLUMN IF NOT EXISTS "itemsData" JSONB;`);

    console.log('Schema alter queries completed successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Error altering schema:', err);
    process.exit(1);
  }
}

fixSchema();
