const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// Protect stock routes with JWT & RBAC (All roles can access stock module)
router.use(verifyToken);
router.use(authorizeRoles('Admin', 'Stock_Manager', 'Sales_Manager', 'Purchase_Manager', 'Production_Manager', 'Quality_Manager', 'Employee'));

// 0. Stock Module Root -> Redirects to Analytics Dashboard
router.get('/', (req, res) => res.redirect('/stock/analytics'));

// 1. Stock Analytics Dashboard
router.get('/analytics', stockController.showAnalytics);

// 2. Stock Items Routes
router.get('/items', stockController.listItems);
router.get('/add', stockController.renderAdd);
router.get('/items/add', stockController.renderAdd);
router.post('/add', stockController.addItem);
router.post('/items/add', stockController.addItem);

// 3. Multi-Warehouse & Locations Routes
router.get('/warehouses', stockController.listWarehouses);
router.post('/warehouses/add', stockController.addWarehouse);
router.post('/locations/add', stockController.addLocation);

// 4. Lot/Batch & Serial Number Routes
router.get('/lots', stockController.listLots);
router.post('/lots/add', stockController.addLot);

// 5. Movements & Transfers Routes
router.get('/transfers', stockController.listTransfers);
router.post('/transfers/add', stockController.addTransfer);

// 6. Goods Receipt (Satın Alma Mal Kabul)
router.get('/goods-receipt', stockController.listGoodsReceipt);
router.get('/goods-receipt/create', stockController.renderCreateGoodsReceipt);
router.post('/goods-receipt/create', stockController.processGoodsReceipt);
router.get('/goods-receipt/history/:orderId', stockController.viewGoodsReceiptHistory);
router.post('/goods-receipt/:id/confirm', stockController.confirmGoodsReceipt);

// 7. Dispatch (Sevkiyat & Çıkış)
router.get('/dispatch', stockController.listDispatch);
router.post('/dispatch/:id/confirm', stockController.confirmDispatch);

// 8. Inventory Counting Routes
router.get('/counting', stockController.listCounting);
router.post('/counting/add', stockController.addCounting);

// 9. Critical Stock & Min/Max Alerts Routes
router.get('/alerts', stockController.listAlerts);
router.post('/alerts/requisition', stockController.createStockRequisition);

// 10. Valuation (FIFO / Weighted Average) Routes
router.get('/valuation', stockController.listValuation);

// 11. Handheld Terminal / Barcode Scanner Routes
router.get('/terminal', stockController.renderTerminal);

module.exports = router;
