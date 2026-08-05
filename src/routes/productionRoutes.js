const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../validations/validator');
const { validateProductionOrderCreate } = require('../validations/productionValidation');

// Protect all production routes with JWT verification & RBAC (Admin, Production_Manager)
router.use(verifyToken, authorizeRoles('Admin', 'Production_Manager'));

// 1. Work Orders Routes
router.get('/', (req, res) => res.redirect('/production/orders'));
router.get('/orders', productionController.listOrders);
router.get('/orders/add', productionController.renderAddOrder);
router.post('/orders/add', validate(validateProductionOrderCreate), productionController.addOrder);
router.post('/orders/:id/status', productionController.updateOrderStatus);


// 3. BOM (Bill of Materials) Routes
router.get('/bom', productionController.listBOM);
router.post('/bom', productionController.addBOM);

// 4. Routing Operations Routes
router.get('/routing', productionController.listRouting);
router.post('/routing', productionController.addRouting);

// 5. Capacity Planning Routes
router.get('/capacity', productionController.listCapacity);

// 6. MES Shop Floor Tracking Routes
router.get('/mes', productionController.listMES);
router.post('/mes/:id', productionController.updateMES);

module.exports = router;
