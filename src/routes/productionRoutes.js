const express = require('express');
const router = express.Router();
const productionController = require('../controllers/productionController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');
const validate = require('../validations/validator');
const { validateProductionOrderCreate } = require('../validations/productionValidation');

// Protect all production routes with JWT verification & RBAC
router.use(verifyToken);
router.use(authorizeRoles('Admin', 'Production_Manager', 'Stock_Manager', 'Sales_Manager', 'Purchase_Manager', 'Quality_Manager', 'Employee', 'Ozel_Saha_Uzmani'));

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
router.get('/mrp/api/analysis', productionController.apiGetMRP);

// 3. BOM (Bill of Materials) Routes
router.get('/bom', productionController.listBOM);
router.get('/bom/add', productionController.renderBOMForm);
router.get('/bom/edit/:finishedStockItemId', productionController.renderBOMForm);
router.post('/bom', productionController.saveBOM);
router.post('/bom/save', productionController.saveBOM);
router.post('/bom/delete/:finishedStockItemId', productionController.deleteBOM);

// 4. Routing Operations Routes
router.get('/routing', productionController.listRouting);
router.get('/routing/add', productionController.renderRoutingForm);
router.get('/routing/edit/:stockItemId', productionController.renderRoutingForm);
router.post('/routing/save', productionController.saveRouting);
router.post('/routing/delete/:stockItemId', productionController.deleteRouting);

// 5. Capacity Planning Routes
router.get('/capacity', productionController.listCapacity);

// 6. MES Shop Floor Tracking Routes
router.get('/mes', productionController.listMES);
router.post('/mes/:id', productionController.updateMES);

// 7. Workshop (Atölye Kartları) Routes
const workshopController = require('../controllers/workshopController');
router.get('/workshops', workshopController.listWorkshops);
router.get('/workshops/add', workshopController.renderAddWorkshop);
router.get('/workshops/edit/:id', workshopController.renderEditWorkshop);
router.post('/workshops/save', workshopController.saveWorkshop);
router.post('/workshops/delete/:id', workshopController.deleteWorkshop);

// 8. Work Centers (İş Merkezleri) Routes
const workCenterController = require('../controllers/workCenterController');
router.get('/work-centers', workCenterController.listWorkCenters);
router.get('/work-centers/add', workCenterController.renderAddWorkCenter);
router.get('/work-centers/edit/:id', workCenterController.renderEditWorkCenter);
router.post('/work-centers/save', workCenterController.saveWorkCenter);
router.post('/work-centers/delete/:id', workCenterController.deleteWorkCenter);

module.exports = router;
