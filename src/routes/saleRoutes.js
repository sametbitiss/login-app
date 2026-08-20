const express = require('express');
const router = express.Router();
const saleController = require('../controllers/saleController');
const { verifyToken } = require('../middleware/authMiddleware');
const { authorizeRoles } = require('../middleware/rbacMiddleware');

// Protect all sales routes with JWT verification & RBAC
router.use(verifyToken);
router.use(authorizeRoles('Admin', 'Sales_Manager', 'Stock_Manager'));

// 0. Sales Module Root -> Redirects to Analytics Dashboard as requested
router.get('/', (req, res) => res.redirect('/sales/analytics'));

// 1. Satış Siparişleri Routes
router.get('/orders', saleController.listOrders);
router.get('/orders/add', saleController.renderAddOrder);
router.post('/orders/add', saleController.addOrder);
router.get('/orders/:id/edit', saleController.renderEditOrder);
router.post('/orders/:id/edit', saleController.editOrder);
router.get('/orders/:id/detail', saleController.viewOrder);
router.get('/orders/detail/:id', saleController.viewOrder);
router.get('/orders/:id', saleController.viewOrder);

// 2. Teklifler & Fiyatlandırma Routes
router.get('/quotes', saleController.listQuotations);
router.get('/quotes/add', saleController.renderAddQuotation);
router.post('/quotes/add', saleController.addQuotation);
router.get('/quotes/:id/detail', saleController.viewQuotation);
router.get('/quotes/detail/:id', saleController.viewQuotation);
router.get('/quotes/:id', saleController.viewQuotation);
router.post('/quotes/:id/convert', saleController.convertQuotationToOrder);

// 2b. Özel Fiyat Listeleri
router.get('/price-lists', saleController.listPriceLists);
router.get('/price-lists/add', saleController.renderAddPriceList);
router.post('/price-lists/add', saleController.addPriceList);
router.post('/price-lists/delete-customer/:customerId', saleController.deleteCustomerPriceLists);
router.post('/price-lists/delete-item/:id', saleController.deletePriceListItem);

// 3. Cari & Müşteri Kartları Routes
router.get('/customers', saleController.listCustomers);
router.get('/customers/add', saleController.renderAddCustomer);
router.post('/customers/add', saleController.addCustomer);
router.get('/customers/:id/detail', saleController.viewCustomer);
router.get('/customers/detail/:id', saleController.viewCustomer);
router.get('/customers/:id', saleController.viewCustomer);
router.post('/customers/:id/ledger/add', saleController.addCustomerLedgerEntry);

// 4. Sevkiyat & İrsaliyeler Routes
router.get('/dispatches', saleController.listDispatches);
router.post('/dispatches/add', saleController.addDispatch);
router.get('/dispatches/:id/detail', saleController.viewDispatch);
router.get('/dispatches/detail/:id', saleController.viewDispatch);
router.get('/dispatches/:id', saleController.viewDispatch);

// 5. Faturalandırma Routes
router.get('/invoices', saleController.listInvoices);
router.post('/invoices/create-from-order/:id', saleController.createInvoiceFromOrder);
router.get('/invoices/:id/detail', saleController.viewInvoice);
router.get('/invoices/:id', saleController.viewInvoice);

// 6. Yönetsel Onaylar Routes
router.get('/approvals', saleController.listApprovals);
router.post('/approvals/:type/:id/action', saleController.approveOrderOrQuote);

// 7. Satış Analitiği Dashboard Route
router.get('/analytics', saleController.showAnalytics);

// 8. Dynamic API Endpoints for UI Lookup
router.get('/api/customer-price', saleController.apiGetCustomerPrice);
router.get('/api/stock-info/:stockItemId', saleController.apiGetStockInfo);

module.exports = router;
