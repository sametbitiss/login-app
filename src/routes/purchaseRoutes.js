const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchaseController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// Protect all purchase routes with JWT verification & RBAC
router.use(verifyToken);
router.use(authorizeRoles('Admin', 'Purchase_Manager', 'Stock_Manager', 'Production_Manager', 'Quality_Manager', 'Sales_Manager', 'Employee'));

// 0. Purchase Module Root -> Redirects to Analytics Dashboard
router.get('/', (req, res) => res.redirect('/purchase/analytics'));

// 1. Satın Alma Analitiği Dashboard
router.get('/analytics', purchaseController.showAnalytics);

// 2. Satın Alma Talepleri (Requisitions)
router.get('/requisitions', purchaseController.listRequisitions);
router.get('/requisitions/add', purchaseController.renderAddRequisition);
router.post('/requisitions/add', purchaseController.addRequisition);
router.post('/requisitions/:id/convert', purchaseController.convertRequisition);

// 3. Teklif Yönetimi (RFQ)
router.get('/rfq', purchaseController.listRfqs);
router.get('/rfq/add', purchaseController.renderAddRfq);
router.post('/rfq/add', purchaseController.addRfq);
router.post('/rfq/:id/accept', purchaseController.acceptRfq);
router.post('/rfq/:id/reject', purchaseController.rejectRfq);

// 4. Satın Alma Siparişleri
router.get('/orders', purchaseController.listOrders);
router.get('/orders/add', purchaseController.renderAddOrder);
router.post('/orders/add', purchaseController.addOrder);
router.get('/orders/:id/edit', purchaseController.renderEditOrder);
router.post('/orders/:id/edit', purchaseController.editOrder);
router.get('/orders/:id/detail', purchaseController.viewOrderDetail);
router.get('/orders/detail/:id', purchaseController.viewOrderDetail);
router.get('/orders/:id', purchaseController.viewOrderDetail);

// 5. Mal Kabul (GRN)
router.get('/goods-receipt', purchaseController.listGoodsReceipts);
router.get('/goods-receipt/add', purchaseController.renderAddGoodsReceipt);
router.post('/goods-receipt/add', purchaseController.addGoodsReceipt);

// 6. Tedarikçi Kartları
router.get('/suppliers', purchaseController.listSuppliers);
router.get('/suppliers/add', purchaseController.renderAddSupplier);
router.post('/suppliers/add', purchaseController.addSupplier);
router.get('/suppliers/:id/detail', purchaseController.viewSupplierDetail);
router.get('/suppliers/detail/:id', purchaseController.viewSupplierDetail);
router.get('/suppliers/:id', purchaseController.viewSupplierDetail);

// 7. Onay Paneli
router.get('/approvals', purchaseController.listApprovals);
router.post('/approvals/:type/:id/action', purchaseController.approveAction);

module.exports = router;
