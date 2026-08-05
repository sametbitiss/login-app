const purchaseRepository = require('../repositories/purchaseRepository');
const supplierRepository = require('../repositories/supplierRepository');
const rfqRepository = require('../repositories/rfqRepository');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const requisitionRepository = require('../repositories/requisitionRepository');
const stockRepository = require('../repositories/stockRepository');
const { ValidationError, NotFoundError } = require('../utils/appError');
const { PurchaseOrder, PurchaseRfq, GoodsReceipt, Supplier, PurchaseRequisition, StockItem, sequelize } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');

class PurchaseService {
  // ═══════════════════════ PURCHASE ORDERS ═══════════════════════
  async getAllOrders(filters = {}) {
    return await purchaseRepository.findAll(filters);
  }

  async getOrderById(id) {
    const order = await purchaseRepository.findById(id);
    if (!order) throw new NotFoundError('Satın alma siparişi bulunamadı.');
    return order;
  }

  async createOrder(data, currentUser, ipAddress) {
    const existing = await purchaseRepository.findByOrderNo(data.orderNo);
    if (existing) {
      throw new ValidationError('Bu satın alma sipariş numarası zaten mevcuttur.');
    }

    const stockItem = await stockRepository.findById(data.stockItemId);
    if (!stockItem) {
      throw new ValidationError('Seçilen stok kartı / malzeme bulunamadı.');
    }

    const quantity = parseFloat(data.quantity) || 0;
    const unitPrice = parseFloat(data.unitPrice) || 0;
    const discountRate = parseFloat(data.discountRate) || 0;
    const taxRate = parseFloat(data.taxRate) || 20;

    if (quantity <= 0) throw new ValidationError('Sipariş miktarı sıfırdan büyük olmalıdır.');
    if (unitPrice < 0) throw new ValidationError('Birim alış fiyatı negatif olamaz.');

    const subtotal = quantity * unitPrice;
    const discountAmount = subtotal * (discountRate / 100);
    const amountAfterDiscount = subtotal - discountAmount;
    const taxAmount = amountAfterDiscount * (taxRate / 100);
    const totalAmount = amountAfterDiscount + taxAmount;

    // Budget approval check: orders > 50,000 TRY need approval
    let status = data.status || 'Ordered';
    if (totalAmount > 50000) {
      status = 'Pending_Approval';
    }

    const computedData = {
      ...data,
      status,
      subtotal: parseFloat(subtotal.toFixed(4)),
      discountAmount: parseFloat(discountAmount.toFixed(4)),
      taxAmount: parseFloat(taxAmount.toFixed(4)),
      totalAmount: parseFloat(totalAmount.toFixed(4))
    };

    return await purchaseRepository.create(computedData, currentUser, ipAddress);
  }

  async updateOrder(id, data, currentUser, ipAddress) {
    const order = await purchaseRepository.update(id, data, currentUser, ipAddress);
    if (!order) throw new NotFoundError('Güncellenecek satın alma siparişi bulunamadı.');
    return order;
  }

  async deleteOrder(id, currentUser, ipAddress) {
    const result = await purchaseRepository.delete(id, currentUser, ipAddress);
    if (!result) throw new NotFoundError('Silinecek satın alma siparişi bulunamadı.');
    return result;
  }

  async getNextOrderNo() {
    return await purchaseRepository.getNextOrderNo();
  }

  async getStats() {
    return await purchaseRepository.getStats();
  }

  // ═══════════════════════ SUPPLIERS ═══════════════════════
  async getAllSuppliers(filters = {}) {
    return await supplierRepository.findAll(filters);
  }

  async getSupplierById(id) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) throw new NotFoundError('Tedarikçi bulunamadı.');
    return supplier;
  }

  async getSupplierWithOrders(id) {
    const supplier = await supplierRepository.getSupplierWithOrders(id);
    if (!supplier) throw new NotFoundError('Tedarikçi bulunamadı.');
    return supplier;
  }

  async createSupplier(data, currentUser, ipAddress) {
    const existing = await supplierRepository.findByCode(data.supplierCode);
    if (existing) {
      throw new ValidationError('Bu tedarikçi kodu zaten mevcuttur.');
    }
    return await supplierRepository.create(data, currentUser, ipAddress);
  }

  async updateSupplier(id, data, currentUser, ipAddress) {
    const supplier = await supplierRepository.update(id, data, currentUser, ipAddress);
    if (!supplier) throw new NotFoundError('Tedarikçi bulunamadı.');
    return supplier;
  }

  async getNextSupplierCode() {
    return await supplierRepository.getNextCode();
  }

  async getSupplierStats() {
    return await supplierRepository.getStats();
  }

  // ═══════════════════════ RFQ ═══════════════════════
  async getAllRfqs(filters = {}) {
    return await rfqRepository.findAll(filters);
  }

  async getRfqById(id) {
    const rfq = await rfqRepository.findById(id);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');
    return rfq;
  }

  async createRfq(data, currentUser, ipAddress) {
    return await rfqRepository.create(data, currentUser, ipAddress);
  }

  async updateRfq(id, data, currentUser, ipAddress) {
    const rfq = await rfqRepository.update(id, data, currentUser, ipAddress);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');
    return rfq;
  }

  async acceptRfq(id, currentUser, ipAddress) {
    const rfq = await rfqRepository.findById(id);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');

    // Mark this one as winner
    await rfqRepository.update(id, { status: 'Accepted', isWinner: true }, currentUser, ipAddress);

    // Convert to Purchase Order
    const nextOrderNo = await this.getNextOrderNo();
    const quantity = parseFloat(rfq.requestedQuantity) || 1;
    const unitPrice = parseFloat(rfq.offeredUnitPrice) || 0;
    const subtotal = quantity * unitPrice;
    const taxRate = 20;
    const taxAmount = subtotal * (taxRate / 100);
    const totalAmount = subtotal + taxAmount;

    await this.createOrder({
      orderNo: nextOrderNo,
      supplierName: rfq.supplierName,
      supplierId: rfq.supplierId,
      orderDate: new Date().toISOString().split('T')[0],
      expectedDeliveryDate: rfq.deliveryDays ? new Date(Date.now() + rfq.deliveryDays * 86400000).toISOString().split('T')[0] : null,
      paymentTerm: rfq.paymentTerm || 'Vadeli_30',
      status: 'Ordered',
      priority: 'Normal',
      stockItemId: rfq.stockItemId,
      quantity,
      unitPrice,
      taxRate,
      currency: rfq.currency || 'TRY',
      notes: `[RFQ: ${rfq.rfqNo}] Teklif değerlendirmesi sonucu oluşturuldu.`,
      purchasingAgent: currentUser.firstName ? `${currentUser.firstName} ${currentUser.lastName}` : currentUser.username
    }, currentUser, ipAddress);

    return rfq;
  }

  async getNextRfqNo() {
    return await rfqRepository.getNextRfqNo();
  }

  async getRfqStats() {
    return await rfqRepository.getStats();
  }

  // ═══════════════════════ GOODS RECEIPT ═══════════════════════
  async getAllGoodsReceipts(filters = {}) {
    return await goodsReceiptRepository.findAll(filters);
  }

  async getGoodsReceiptById(id) {
    const grn = await goodsReceiptRepository.findById(id);
    if (!grn) throw new NotFoundError('Mal kabul fişi bulunamadı.');
    return grn;
  }

  async createGoodsReceipt(data, currentUser, ipAddress) {
    return await goodsReceiptRepository.create(data, currentUser, ipAddress);
  }

  async getNextGrnNo() {
    return await goodsReceiptRepository.getNextGrnNo();
  }

  async getGoodsReceiptStats() {
    return await goodsReceiptRepository.getStats();
  }

  // ═══════════════════════ REQUISITIONS ═══════════════════════
  async getAllRequisitions(filters = {}) {
    return await requisitionRepository.findAll(filters);
  }

  async createRequisition(data, currentUser, ipAddress) {
    return await requisitionRepository.create(data, currentUser, ipAddress);
  }

  async getNextRequisitionNo() {
    return await requisitionRepository.getNextRequisitionNo();
  }

  // ═══════════════════════ APPROVALS ═══════════════════════
  async getPendingApprovals() {
    const pendingOrders = await PurchaseOrder.findAll({
      where: { status: 'Pending_Approval' },
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const pendingRequisitions = await PurchaseRequisition.findAll({
      where: { status: 'Pending' },
      include: [
        { model: StockItem, as: 'stockItem', attributes: ['id', 'stockCode', 'name', 'unit'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return { pendingOrders, pendingRequisitions };
  }

  async approveOrder(id, action, currentUser, ipAddress) {
    const order = await purchaseRepository.findById(id);
    if (!order) throw new NotFoundError('Sipariş bulunamadı.');

    if (action === 'approve') {
      await purchaseRepository.update(id, { status: 'Ordered' }, currentUser, ipAddress);
    } else if (action === 'reject') {
      await purchaseRepository.update(id, { status: 'Cancelled' }, currentUser, ipAddress);
    }
    return order;
  }

  async approveRequisition(id, action, currentUser, ipAddress) {
    const req = await PurchaseRequisition.findByPk(id);
    if (!req) throw new NotFoundError('Talep bulunamadı.');

    if (action === 'approve') {
      await requisitionRepository.updateStatus(id, 'Approved', currentUser, ipAddress);
    } else if (action === 'reject') {
      await requisitionRepository.updateStatus(id, 'Rejected', currentUser, ipAddress);
    }
    return req;
  }

  // ═══════════════════════ ANALYTICS ═══════════════════════
  async getAnalyticsData() {
    const stats = await purchaseRepository.getStats();
    const supplierStats = await supplierRepository.getStats();
    const rfqStats = await rfqRepository.getStats();
    const grnStats = await goodsReceiptRepository.getStats();

    // Supplier-based spend breakdown
    const supplierSpend = await PurchaseOrder.findAll({
      attributes: [
        'supplierName',
        [fn('COUNT', col('id')), 'orderCount'],
        [fn('SUM', col('totalAmount')), 'totalSpend']
      ],
      where: { status: { [Op.ne]: 'Cancelled' } },
      group: ['supplierName'],
      order: [[fn('SUM', col('totalAmount')), 'DESC']],
      limit: 10,
      raw: true
    });

    // Monthly spend trend (last 6 months)
    const monthlySpend = await PurchaseOrder.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'month', col('orderDate')), 'month'],
        [fn('SUM', col('totalAmount')), 'total']
      ],
      where: { status: { [Op.ne]: 'Cancelled' } },
      group: [fn('DATE_TRUNC', 'month', col('orderDate'))],
      order: [[fn('DATE_TRUNC', 'month', col('orderDate')), 'ASC']],
      limit: 6,
      raw: true
    }).catch(() => []);

    // Top purchased items
    const topItems = await PurchaseOrder.findAll({
      attributes: [
        'stockItemId',
        [fn('SUM', col('PurchaseOrder.quantity')), 'totalQty'],
        [fn('SUM', col('totalAmount')), 'totalSpend']
      ],
      include: [{ model: StockItem, as: 'stockItem', attributes: ['name', 'stockCode'] }],
      where: { status: { [Op.ne]: 'Cancelled' } },
      group: ['stockItemId', 'stockItem.id', 'stockItem.name', 'stockItem.stockCode'],
      order: [[fn('SUM', col('totalAmount')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true
    }).catch(() => []);

    // Recent orders
    const recentOrders = await PurchaseOrder.findAll({
      include: [{ model: StockItem, as: 'stockItem', attributes: ['name', 'stockCode'] }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    return {
      stats,
      supplierStats,
      rfqStats,
      grnStats,
      supplierSpend,
      monthlySpend,
      topItems,
      recentOrders
    };
  }
}

module.exports = new PurchaseService();
