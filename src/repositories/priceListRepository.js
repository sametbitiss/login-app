const { CustomerPriceList, CustomerAccount, StockItem, User } = require('../../models');

class PriceListRepository {
  async findAll() {
    return await CustomerPriceList.findAll({
      include: [
        { model: CustomerAccount, as: 'customer', attributes: ['id', 'companyName', 'customerCode'] },
        { model: StockItem, as: 'stockItem', attributes: ['id', 'name', 'stockCode', 'unit', 'salePrice'] },
        { model: User, as: 'creator', attributes: ['id', 'username'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findCustomerSpecialPrice(customerId, stockItemId) {
    if (!customerId) return null;
    return await CustomerPriceList.findOne({
      where: {
        customerId,
        stockItemId,
        status: 'Active'
      },
      order: [['createdAt', 'DESC']]
    });
  }

  async create(data, currentUser) {
    return await CustomerPriceList.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });
  }
}

module.exports = new PriceListRepository();
