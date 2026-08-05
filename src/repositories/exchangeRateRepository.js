const { ExchangeRate, User } = require('../../models');

class ExchangeRateRepository {
  async findAll() {
    return await ExchangeRate.findAll({
      include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
      order: [['effectiveDate', 'DESC'], ['currencyCode', 'ASC']]
    });
  }

  async getLatestRates() {
    const rates = await ExchangeRate.findAll({
      order: [['effectiveDate', 'DESC']]
    });
    const latestMap = { TRY: 1.0 };
    rates.forEach(r => {
      if (!latestMap[r.currencyCode]) {
        latestMap[r.currencyCode] = parseFloat(r.rateToTRY);
      }
    });
    return latestMap;
  }

  async create(data, currentUser) {
    return await ExchangeRate.create({
      ...data,
      createdBy: currentUser ? currentUser.id : null
    });
  }
}

module.exports = new ExchangeRateRepository();
