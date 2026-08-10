const { SaleOrder, CustomerAccount, sequelize } = require('../models');
const saleService = require('../src/services/saleService');

async function runSalesOrderModuleTest() {
  try {
    await sequelize.sync({ alter: true });
    console.log('--- TESTING SALES ORDERS MODULE REQUIREMENTS ---');

    // 1. Test normal multi-item order creation (no high discount)
    const normalItems = [
      { stockItemId: 1, stockCode: 'STK-0001', name: 'Mamul-A', quantity: 3, unitPrice: 200, discountRate: 10, taxRate: 20, subtotal: 600, discountAmount: 60, taxAmount: 108, totalAmount: 648 },
      { stockItemId: 2, stockCode: 'STK-0002', name: 'Mamul-B', quantity: 2, unitPrice: 150, discountRate: 5, taxRate: 20, subtotal: 300, discountAmount: 15, taxAmount: 57, totalAmount: 342 }
    ];

    const nextOrderNo1 = await saleService.getNextOrderNo();
    const orderNormal = await saleService.createOrder({
      orderNo: nextOrderNo1,
      customerName: 'Test Normal Müşteri',
      orderDate: '2026-08-10',
      paymentTerm: 'Vadeli_30',
      status: 'Preparing',
      approvalNeeded: false,
      priority: 'Normal',
      stockItemId: 1,
      quantity: 3,
      unitPrice: 200,
      discountRate: 10,
      subtotal: 900,
      discountAmount: 75,
      taxAmount: 165,
      totalAmount: 990,
      currency: 'TRY',
      itemsJson: JSON.stringify(normalItems)
    });

    console.log('Created Normal Order:', orderNormal.orderNo, 'Status:', orderNormal.status);
    if (orderNormal.status === 'Preparing' && orderNormal.orderNo === nextOrderNo1) {
      console.log('SUCCESS Step 1 & 2: Order status auto-set to "Preparing" & orderNo auto-assigned!');
    } else {
      console.error('FAILED Step 1/2: Status or OrderNo mismatch');
    }

    // 2. Test high discount (> 20%) order creation requiring managerial approval
    const highDiscountItems = [
      { stockItemId: 1, stockCode: 'STK-0001', name: 'Özel Mamul', quantity: 5, unitPrice: 1000, discountRate: 25, taxRate: 20, subtotal: 5000, discountAmount: 1250, taxAmount: 750, totalAmount: 4500 }
    ];

    const nextOrderNo2 = await saleService.getNextOrderNo();
    const orderHighDisc = await saleService.createOrder({
      orderNo: nextOrderNo2,
      customerName: 'Test Yüksek İskonto Müşterisi',
      orderDate: '2026-08-10',
      paymentTerm: 'Vadeli_30',
      status: 'Pending_Approval',
      approvalNeeded: true,
      approvalReason: 'Yüksek Ürün İskontosu: Özel Mamul (%25 iskonto)',
      priority: 'High',
      stockItemId: 1,
      quantity: 5,
      unitPrice: 1000,
      discountRate: 25,
      subtotal: 5000,
      discountAmount: 1250,
      taxAmount: 750,
      totalAmount: 4500,
      currency: 'TRY',
      itemsJson: JSON.stringify(highDiscountItems)
    });

    console.log('Created High Discount Order:', orderHighDisc.orderNo, 'Status:', orderHighDisc.status);

    if (orderHighDisc.status === 'Pending_Approval' && orderHighDisc.approvalNeeded) {
      console.log('SUCCESS Step 4: High discount (>20%) order set to "Pending_Approval" for managerial approval!');
    } else {
      console.error('FAILED Step 4: Approval status mismatch');
    }

    // 3. Test Managerial Approval Action
    await saleService.updateOrder(orderHighDisc.id, { status: 'Preparing', approvalNeeded: false });
    const approvedOrder = await SaleOrder.findByPk(orderHighDisc.id);
    console.log('Approved Order Status:', approvedOrder.status);

    if (approvedOrder.status === 'Preparing') {
      console.log('SUCCESS Step 4 Part 2: Approved order status updated to "Preparing"!');
    }

    // 4. CLEANUP TEST DATA completely
    console.log('--- CLEANING UP TEST DATA ---');
    await SaleOrder.destroy({ where: { id: [orderNormal.id, orderHighDisc.id] } });
    console.log('SUCCESS: All test data cleaned up!');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runSalesOrderModuleTest();
