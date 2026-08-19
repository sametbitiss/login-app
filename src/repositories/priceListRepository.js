const { MusteriFiyatListesi, MusteriHesabi, StokKarti, Kullanici } = require('../../models');

class PriceListRepository {
  async findAll() {
    return await MusteriFiyatListesi.findAll({
      include: [
        { model: MusteriHesabi, as: 'musteri', attributes: ['id', 'firmaAdi', 'musteriKodu'] },
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'ad', 'stokKodu', 'birim', 'satisFiyati'] },
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findCustomerSpecialPrice(musteriId, stokId) {
    if (!musteriId) return null;
    return await MusteriFiyatListesi.findOne({
      where: {
        musteriId,
        stokId,
        durum: 'Active'
      },
      order: [['createdAt', 'DESC']]
    });
  }

  async create(data, currentUser) {
    const cleanData = {
      listeAdi: data.listeAdi || data.listName,
      musteriId: data.musteriId || data.customerId,
      stokId: data.stokId || data.stockItemId,
      ozelFiyat: data.ozelFiyat !== undefined ? data.ozelFiyat : data.specialPrice,
      ozelIskontoOrani: data.ozelIskontoOrani !== undefined ? data.ozelIskontoOrani : data.customDiscountRate,
      paraBirimi: data.paraBirimi || data.currency || 'TRY',
      gecerlilikBaslangic: data.gecerlilikBaslangic || data.validFrom,
      gecerlilikBitis: data.gecerlilikBitis || data.validUntil,
      durum: data.durum || data.status || 'Active',
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    return await MusteriFiyatListesi.create(cleanData);
  }
}

module.exports = new PriceListRepository();
