const { sequelize } = require('../models');

async function checkDb() {
  try {
    const [tables] = await sequelize.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`);
    console.log('Tables in public schema:', tables.map(t => t.table_name));

    const [columns] = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'Warehouses';`);
    console.log('Columns in Warehouses table:', columns.map(c => c.column_name));

    const [columnsLower] = await sequelize.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'warehouses';`);
    console.log('Columns in warehouses table:', columnsLower.map(c => c.column_name));

    process.exit(0);
  } catch (err) {
    console.error('Error checking DB:', err);
    process.exit(1);
  }
}

checkDb();
