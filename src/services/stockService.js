const stockRepository = require('../repositories/stockRepository');
const { ValidationError, NotFoundError } = require('../utils/appError');
const { StokKarti } = require('../../models');

class StockService {
  async getAllItems(filters = {}) {
    return await stockRepository.findAll(filters);
  }

  async getItemById(id) {
    const item = await stockRepository.findById(id);
    if (!item) throw new NotFoundError('Stok kartı bulunamadı.');
    return item;
  }

  async createItem(data, currentUser, ipAddress) {
    const stokKodu = data.stokKodu || data.stockCode;
    const existing = await stockRepository.findByStockCode(stokKodu);
    if (existing) {
      throw new ValidationError('Bu stok kodu zaten kullanılmaktadır.');
    }

    const barkod = data.barkod || data.barcode;
    if (barkod) {
      const barcodeExists = await StokKarti.findOne({ where: { barkod } });
      if (barcodeExists) {
        throw new ValidationError('Bu barkod numarası zaten kayıtlıdır.');
      }
    }

    return await stockRepository.create(data, currentUser, ipAddress);
  }

  async updateItem(id, data, currentUser, ipAddress) {
    const item = await stockRepository.update(id, data, currentUser, ipAddress);
    if (!item) throw new NotFoundError('Güncellenecek stok kartı bulunamadı.');
    return item;
  }

  async deleteItem(id, currentUser, ipAddress) {
    const result = await stockRepository.delete(id, currentUser, ipAddress);
    if (!result) throw new NotFoundError('Silinecek stok kartı bulunamadı.');
    return result;
  }

  async getNextStockCode() {
    return await stockRepository.getNextStockCode();
  }
}

module.exports = new StockService();
