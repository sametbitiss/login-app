const db = require('../models');

async function testSync() {
  try {
    console.log('Synchronizing database models...');
    await db.sequelize.sync({ force: true });
    console.log('Database synced successfully! Loaded models:', Object.keys(db).filter(k => !['sequelize', 'Sequelize'].includes(k)));
    process.exit(0);
  } catch (error) {
    console.error('Database sync failed:', error);
    process.exit(1);
  }
}

testSync();
