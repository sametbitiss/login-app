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
    const siparisNo = data.siparisNo || data.orderNo;
    const existing = await saleRepository.findByOrderNo(siparisNo);
    if (existing) {
      throw new ValidationError('Bu sipariş numarası zaten mevcuttur.');
    }

    const stokId = parseInt(data.stokId || data.stockItemId, 10);
    if (!isNaN(stokId) && stokId > 0) {
      const stockItem = await stockRepository.findById(stokId);
      const itemsJson = data.kalemlerJson || data.itemsJson;
      if (!stockItem && (!itemsJson || itemsJson === '[]')) {
        throw new ValidationError('Seçilen stok kartı sistemde bulunamadı.');
      }
    }

    let itemsList = [];
    const rawItemsJson = data.kalemlerJson || data.itemsJson;
    if (rawItemsJson) {
      try {
        itemsList = typeof rawItemsJson === 'string' ? JSON.parse(rawItemsJson) : rawItemsJson;
      } catch (e) {
        itemsList = [];
      }
    }

    let subtotal = 0;
    let discountAmount = 0;
    let taxAmount = 0;
    let totalAmount = 0;

    if (Array.isArray(itemsList) && itemsList.length > 0) {
      itemsList.forEach(it => {
        const q = parseFloat(it.miktar || it.quantity) || 1;
        const p = parseFloat(it.birimFiyat || it.unitPrice) || 0;
        const d = parseFloat(it.iskontoOrani || it.discountRate) || 0;
        const t = parseFloat(it.kdvOrani || it.taxRate) || 20;

        const lineSub = q * p;
        const lineDisc = lineSub * (d / 100);
        const lineAfterDisc = lineSub - lineDisc;
        const lineTax = lineAfterDisc * (t / 100);
        const lineTot = lineAfterDisc + lineTax;

        subtotal += lineSub;
        discountAmount += lineDisc;
        taxAmount += lineTax;
        totalAmount += lineTot;
      });
    } else {
      const quantity = parseFloat(data.miktar !== undefined ? data.miktar : data.quantity) || 0;
      const unitPrice = parseFloat(data.birimFiyat !== undefined ? data.birimFiyat : data.unitPrice) || 0;
      const discountRate = parseFloat(data.iskontoOrani !== undefined ? data.iskontoOrani : data.discountRate) || 0;
      const taxRate = parseFloat(data.kdvOrani !== undefined ? data.kdvOrani : data.taxRate) || 20;

      if (quantity <= 0) throw new ValidationError('Sipariş miktarı sıfırdan büyük olmalıdır.');
      if (unitPrice < 0) throw new ValidationError('Birim fiyat negatif olamaz.');

      subtotal = quantity * unitPrice;
      discountAmount = subtotal * (discountRate / 100);
      const amountAfterDiscount = subtotal - discountAmount;
      taxAmount = amountAfterDiscount * (taxRate / 100);
      totalAmount = amountAfterDiscount + taxAmount;
    }

    if (data.araToplam !== undefined || data.subtotal !== undefined) {
      const v = parseFloat(data.araToplam !== undefined ? data.araToplam : data.subtotal);
      if (v > 0) subtotal = v;
    }
    if (data.iskontoTutari !== undefined || data.discountAmount !== undefined) {
      const v = parseFloat(data.iskontoTutari !== undefined ? data.iskontoTutari : data.discountAmount);
      if (v >= 0) discountAmount = v;
    }
    if (data.kdvTutari !== undefined || data.taxAmount !== undefined) {
      const v = parseFloat(data.kdvTutari !== undefined ? data.kdvTutari : data.taxAmount);
      if (v >= 0) taxAmount = v;
    }
    if (data.toplamTutar !== undefined || data.totalAmount !== undefined) {
      const v = parseFloat(data.toplamTutar !== undefined ? data.toplamTutar : data.totalAmount);
      if (v > 0) totalAmount = v;
    }

    const computedData = {
      ...data,
      araToplam: parseFloat(subtotal.toFixed(4)),
      iskontoTutari: parseFloat(discountAmount.toFixed(4)),
      kdvTutari: parseFloat(taxAmount.toFixed(4)),
      toplamTutar: parseFloat(totalAmount.toFixed(4))
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
