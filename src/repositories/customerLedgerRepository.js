const { MusteriCariHareket, MusteriHesabi, Kullanici } = require('../../models');

class CustomerLedgerRepository {
  async findByCustomerId(musteriId) {
    return await MusteriCariHareket.findAll({
      where: { musteriId },
      include: [{ model: Kullanici, as: 'olusturan', attributes: ['kullaniciAdi'] }],
      order: [['islemTarihi', 'ASC'], ['id', 'ASC']]
    });
  }

  async addEntry(data, currentUser) {
    const targetCustomerId = data.musteriId || data.customerId;
    const lastEntry = await MusteriCariHareket.findOne({
      where: { musteriId: targetCustomerId },
      order: [['id', 'DESC']]
    });

    const previousBalance = lastEntry ? parseFloat(lastEntry.bakiye) : 0.00;
    const debit = parseFloat(data.borcTutari !== undefined ? data.borcTutari : data.debitAmount) || 0.00;
    const credit = parseFloat(data.alacakTutari !== undefined ? data.alacakTutari : data.creditAmount) || 0.00;
    const newBalance = previousBalance + debit - credit;

    const entry = await MusteriCariHareket.create({
      musteriId: targetCustomerId,
      islemTarihi: data.islemTarihi || data.transactionDate || new Date().toISOString().split('T')[0],
      islemTuru: data.islemTuru || data.transactionType || (debit > 0 ? 'Sale_Invoice' : 'Payment'),
      belgeNo: data.belgeNo || data.documentNo,
      aciklama: data.aciklama || data.description,
      borcTutari: debit,
      alacakTutari: credit,
      bakiye: newBalance,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      olusturanId: currentUser ? currentUser.id : null
    });

    const customer = await MusteriHesabi.findByPk(targetCustomerId);
    if (customer) {
      await customer.update({ guncelBakiye: newBalance });
    }

    return entry;
  }
}

module.exports = new CustomerLedgerRepository();
