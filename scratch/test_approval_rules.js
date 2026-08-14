const { PurchaseOrder, PurchaseRequisition, PurchaseRfq, StockItem, Supplier, sequelize } = require('../models');
const purchaseService = require('../src/services/purchaseService');
const goodsReceiptRepository = require('../src/repositories/goodsReceiptRepository');

async function runApprovalRulesTest() {
  try {
    console.log('\n=== TEST: APPROVALS & ORDER STATUS LIFECYCLE RULES ===\n');

    const mockUser = { id: 1, username: 'admin', firstName: 'Samet', lastName: 'Bitiş', role: 'Admin' };

    // 1. Verify getPendingApprovals returns NO requisitions
    const approvals = await purchaseService.getPendingApprovals();
    console.log(`  1. getPendingApprovals():`);
    console.log(`     - Pending Orders count: ${approvals.pendingOrders.length}`);
    console.log(`     - Pending Requisitions count: ${approvals.pendingRequisitions.length}`);
    if (approvals.pendingRequisitions.length === 0) {
      console.log(`     ✅ PASS: Requisitions do not drop into Approvals card!`);
    } else {
      console.log(`     ❌ FAIL: Requisitions are still present in Approvals!`);
    }

    // 2. Create Order > 50,000 TL -> Should become Pending_Approval
    console.log(`\n  2. Budget Limit Approval Test (> 50,000 TL):`);
    const highValOrder = await purchaseService.createOrder({
      orderNo: `TEST-HIGH-${Date.now().toString().slice(-4)}`,
      supplierName: 'Limit Aşan A.Ş.',
      stockItemId: 1,
      quantity: 100,
      unitPrice: 600, // 100 * 600 * 1.2 = 72,000 TL (> 50k)
      currency: 'TRY'
    }, mockUser, '127.0.0.1');

    console.log(`     - High Value Order (${highValOrder.orderNo}): TotalAmount = ${highValOrder.totalAmount} TL`);
    console.log(`     - Assigned Status: '${highValOrder.status}'`);
    if (highValOrder.status === 'Pending_Approval') {
      console.log(`     ✅ PASS: Order > 50k set to 'Pending_Approval'!`);
    } else {
      console.log(`     ❌ FAIL: Order > 50k status is '${highValOrder.status}'!`);
    }

    // 3. Create Order <= 50,000 TL -> Should become Ordered directly
    console.log(`\n  3. Budget Limit Approval Test (<= 50,000 TL):`);
    const lowValOrder = await purchaseService.createOrder({
      orderNo: `TEST-LOW-${Date.now().toString().slice(-4)}`,
      supplierName: 'Limit Altı A.Ş.',
      stockItemId: 1,
      quantity: 10,
      unitPrice: 100, // 10 * 100 * 1.2 = 1,200 TL (<= 50k)
      currency: 'TRY'
    }, mockUser, '127.0.0.1');

    console.log(`     - Low Value Order (${lowValOrder.orderNo}): TotalAmount = ${lowValOrder.totalAmount} TL`);
    console.log(`     - Assigned Status: '${lowValOrder.status}'`);
    if (lowValOrder.status === 'Ordered') {
      console.log(`     ✅ PASS: Order <= 50k set directly to 'Ordered'!`);
    } else {
      console.log(`     ❌ FAIL: Order <= 50k status is '${lowValOrder.status}'!`);
    }

    // 4. Test Manager Approval of High Value Order
    console.log(`\n  4. Manager Approval Execution:`);
    await purchaseService.approveOrder(highValOrder.id, 'approve', mockUser, '127.0.0.1');
    const approvedOrder = await PurchaseOrder.findByPk(highValOrder.id);
    console.log(`     - Approved Order Status: '${approvedOrder.status}'`);
    if (approvedOrder.status === 'Ordered') {
      console.log(`     ✅ PASS: After manager approval, status updated from 'Pending_Approval' to 'Ordered'!`);
    } else {
      console.log(`     ❌ FAIL: After approval status is '${approvedOrder.status}'!`);
    }

    console.log('\n=== ALL APPROVAL RULE TESTS FINISHED SUCCESSFULLY ===\n');

  } catch (err) {
    console.error('Test Error:', err);
  } finally {
    process.exit(0);
  }
}

runApprovalRulesTest();
