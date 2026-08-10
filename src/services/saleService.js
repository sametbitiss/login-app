const saleRepository = require('../repositories/saleRepository');
const stockRepository = require('../repositories/stockRepository');
const { ValidationError, NotFoundError } = require('../utils/appError');

class SaleService {
  async getAllOrders(filters = {}) {
    return await saleRepository.findAll(filters);
  }

  async getOrderById(id) {
    const order = await saleRepository.findById(id);
    if (!order) throw new NotFoundError('Satış siparişi bulunamadı.');
    return order;
  }

  async createOrder(data, currentUser, ipAddress) {
    // 1. Check duplicate order number
    const existing = await saleRepository.findByOrderNo(data.orderNo);
    if (existing) {
      throw new ValidationError('Bu sipariş numarası zaten mevcuttur.');
    }

    // 2. Check stock item existence if valid stockItemId is provided and not multi-item payload
    const stockItemId = parseInt(data.stockItemId, 10);
    if (!isNaN(stockItemId) && stockItemId > 0) {
      const stockItem = await stockRepository.findById(stockItemId);
      if (!stockItem && (!data.itemsJson || data.itemsJson === '[]')) {
        throw new ValidationError('Seçilen stok kartı sistemde bulunamadı.');
      }
    }

    // 3. Mathematical Calculations (Nett, İskonto, KDV, Genel Toplam)
    const quantity = parseFloat(data.quantity) || 0;
    const unitPrice = parseFloat(data.unitPrice) || 0;
    const discountRate = parseFloat(data.discountRate) || 0;
    const taxRate = parseFloat(data.taxRate) || 20;

    if (quantity <= 0) throw new ValidationError('Sipariş miktarı sıfırdan büyük olmalıdır.');
    if (unitPrice < 0) throw new ValidationError('Birim fiyat negatif olamaz.');

    const subtotal = quantity * unitPrice;
    const discountAmount = subtotal * (discountRate / 100);
    const amountAfterDiscount = subtotal - discountAmount;
    const taxAmount = amountAfterDiscount * (taxRate / 100);
    const totalAmount = amountAfterDiscount + taxAmount;

    const computedData = {
      ...data,
      subtotal: parseFloat(subtotal.toFixed(4)),
      discountAmount: parseFloat(discountAmount.toFixed(4)),
      taxAmount: parseFloat(taxAmount.toFixed(4)),
      totalAmount: parseFloat(totalAmount.toFixed(4))
    };

    return await saleRepository.create(computedData, currentUser, ipAddress);
  }

  async updateOrder(id, data, currentUser, ipAddress) {
    const order = await saleRepository.update(id, data, currentUser, ipAddress);
    if (!order) throw new NotFoundError('Güncellenecek satış siparişi bulunamadı.');
    return order;
  }

  async deleteOrder(id, currentUser, ipAddress) {
    const result = await saleRepository.delete(id, currentUser, ipAddress);
    if (!result) throw new NotFoundError('Silinecek satış siparişi bulunamadı.');
    return result;
  }

  async getNextOrderNo() {
    return await saleRepository.getNextOrderNo();
  }

  async getStats() {
    return await saleRepository.getStats();
  }
}

module.exports = new SaleService();
