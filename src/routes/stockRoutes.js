const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// Protect stock routes with JWT & RBAC (Admin, Stock_Manager)
router.use(verifyToken, authorizeRoles('Admin', 'Stock_Manager'));

// 1. Stock Items Routes
router.get('/', stockController.listItems);
router.get('/items', stockController.listItems);
router.get('/add', stockController.renderAdd);
router.get('/items/add', stockController.renderAdd);
router.post('/add', stockController.addItem);
router.post('/items/add', stockController.addItem);

// 2. Multi-Warehouse & Locations Routes
router.get('/warehouses', stockController.listWarehouses);
router.post('/warehouses/add', stockController.addWarehouse);
router.post('/locations/add', stockController.addLocation);

// 3. Lot/Batch & Serial Number Routes
router.get('/lots', stockController.listLots);
router.post('/lots/add', stockController.addLot);

// 4. Movements & Transfers Routes
router.get('/transfers', stockController.listTransfers);
router.post('/transfers/add', stockController.addTransfer);

// 5. Goods Receipt (Satın Alma Mal Kabul)
router.get('/goods-receipt', stockController.listGoodsReceipt);
router.post('/goods-receipt/:id/confirm', stockController.confirmGoodsReceipt);

// 6. Dispatch (Sevkiyat & Çıkış)
router.get('/dispatch', stockController.listDispatch);
router.post('/dispatch/:id/confirm', stockController.confirmDispatch);

// 7. Inventory Counting Routes
router.get('/counting', stockController.listCounting);
router.post('/counting/add', stockController.addCounting);

// 8. Critical Stock & Min/Max Alerts Routes
router.get('/alerts', stockController.listAlerts);
router.post('/alerts/requisition', stockController.createStockRequisition);

// 9. Valuation (FIFO / Weighted Average) Routes
router.get('/valuation', stockController.listValuation);

// 10. Handheld Terminal / Barcode Scanner Routes
router.get('/terminal', stockController.renderTerminal);

module.exports = router;
