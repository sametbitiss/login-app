const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../validations/validator');
const { validateProductionOrderCreate } = require('../validations/productionValidation');

// Protect all production routes with JWT verification & RBAC
router.use(verifyToken, authorizeRoles('Admin', 'Production_Manager'));

// 0. Dashboard & Analytics
router.get('/', (req, res) => res.redirect('/production/analytics'));
router.get('/analytics', productionController.showAnalytics);

// 1. Work Orders & Requisitions Routes
router.get('/requisitions', productionController.listRequisitions);
router.get('/orders', productionController.listOrders);
router.get('/orders/add', productionController.renderAddOrder);
router.post('/orders/add', validate(validateProductionOrderCreate), productionController.addOrder);
router.post('/orders/:id/status', productionController.updateOrderStatus);

// 2. Material Requirements Planning (MRP) Routes
router.get('/mrp', productionController.showMRP);
router.post('/mrp/execute', productionController.executeMRP);

// 3. BOM (Bill of Materials) Routes
router.get('/bom', productionController.listBOM);
router.get('/bom/add', productionController.renderBOMForm);
router.get('/bom/edit/:finishedStockItemId', productionController.renderBOMForm);
router.post('/bom', productionController.saveBOM);
router.post('/bom/save', productionController.saveBOM);
router.post('/bom/delete/:finishedStockItemId', productionController.deleteBOM);

// 4. Routing Operations Routes
router.get('/routing', productionController.listRouting);
router.post('/routing', productionController.addRouting);

// 5. Capacity Planning Routes
router.get('/capacity', productionController.listCapacity);

// 6. MES Shop Floor Tracking Routes
router.get('/mes', productionController.listMES);
router.post('/mes/:id', productionController.updateMES);

module.exports = router;
