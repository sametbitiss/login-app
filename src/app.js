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
sequelize.sync({ alter: true }).then(async () => {
  console.log('Database synced successfully with models.');
  await seedInitialData();
}).catch((err) => {
  console.error('Database Sync Error:', err);
});

module.exports = app;
