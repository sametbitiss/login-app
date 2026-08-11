const { CustomerLedger, CustomerAccount, User } = require('../../models');

class CustomerLedgerRepository {
  async findByCustomerId(customerId) {
    return await CustomerLedger.findAll({
      where: { customerId },
      include: [{ model: User, as: 'creator', attributes: ['username'] }],
      order: [['transactionDate', 'ASC'], ['id', 'ASC']]
    });
  }

  async addEntry(data, currentUser) {
    // 1. Calculate new balance for customer
    const lastEntry = await CustomerLedger.findOne({
      where: { customerId: data.customerId },
      order: [['id', 'DESC']]
    });

    const previousBalance = lastEntry ? parseFloat(lastEntry.balance) : 0.00;
    const debit = parseFloat(data.debitAmount) || 0.00;
    const credit = parseFloat(data.creditAmount) || 0.00;
    const newBalance = previousBalance + debit - credit;

    const entry = await CustomerLedger.create({
      ...data,
      transactionType: data.transactionType || (debit > 0 ? 'Sale_Invoice' : 'Payment'),
      balance: newBalance,
      createdBy: currentUser ? currentUser.id : null
    });

    // 2. Update current balance in CustomerAccount
    const customer = await CustomerAccount.findByPk(data.customerId);
    if (customer) {
      await customer.update({ currentBalance: newBalance });
    }

    return entry;
  }
}

module.exports = new CustomerLedgerRepository();
