const express = require('express');
const router = express.Router();
const qualityController = require('../controllers/qualityController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// Protect all quality routes with JWT verification & RBAC
router.use(verifyToken);
router.use(authorizeRoles('Admin', 'Quality_Manager', 'Production_Manager', 'Stock_Manager', 'Purchase_Manager'));

// 0. Quality Module Root -> Redirects to Analytics Dashboard
router.get('/', (req, res) => res.redirect('/quality/analytics'));
router.get('/analytics', qualityController.showAnalytics);

// 1. Quality Inspections (IQC / IPQC / FQC)
router.get('/inspections', qualityController.listInspections);
router.get('/inspections/add', qualityController.renderAddInspection);
router.post('/inspections/add', qualityController.addInspection);

// 2. Non-Conformance Reports (NCR)
router.get('/ncr', qualityController.listNcrs);
router.get('/ncr/add', qualityController.renderAddNcr);
router.post('/ncr/add', qualityController.addNcr);

// 3. CAPA Actions
router.get('/capa', qualityController.listCapas);
router.post('/capa/add', qualityController.addCapa);

// 4. Lot/Serial Traceability Engine
router.get('/traceability', qualityController.showTraceability);

// 5. Calibration & Gauges
router.get('/equipment', qualityController.listEquipments);
router.post('/equipment/add', qualityController.addEquipment);

// 6. ISO Documents
router.get('/documents', qualityController.listDocuments);
router.post('/documents/add', qualityController.addDocument);

module.exports = router;
