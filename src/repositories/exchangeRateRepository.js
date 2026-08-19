const { DovizKuru, Kullanici } = require('../../models');

class ExchangeRateRepository {
  async findAll() {
    return await DovizKuru.findAll({
      include: [{ model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }],
      order: [['gecerlilikTarihi', 'DESC'], ['dovizKodu', 'ASC']]
    });
  }

  async getLatestRates() {
    const rates = await DovizKuru.findAll({
      order: [['gecerlilikTarihi', 'DESC']]
    });
    const latestMap = { TRY: 1.0 };
    rates.forEach(r => {
      if (!latestMap[r.dovizKodu]) {
        latestMap[r.dovizKodu] = parseFloat(r.tryKuru);
      }
    });
    return latestMap;
  }

  async create(data, currentUser) {
    const cleanData = {
      dovizKodu: data.dovizKodu || data.currencyCode,
      tryKuru: data.tryKuru !== undefined ? data.tryKuru : data.rateToTRY,
      gecerlilikTarihi: data.gecerlilikTarihi || data.effectiveDate || new Date().toISOString().split('T')[0],
      kaynak: data.kaynak || data.source || 'TCMB',
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };
    return await DovizKuru.create(cleanData);
  }
}

module.exports = new ExchangeRateRepository();
