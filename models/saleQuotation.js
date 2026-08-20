'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatisTeklifi extends Model {
    static associate(models) {
      SatisTeklifi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatisTeklifi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      SatisTeklifi.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
    }
  }

  SatisTeklifi.init({
    teklifNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    musteriId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    musteriAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    teklifTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    gecerlilikBitis: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    kalemlerJson: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    miktar: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.0
    },
    birimFiyat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    iskontoOrani: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    kdvOrani: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 20.00
    },
    araToplam: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    iskontoTutari: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    kdvTutari: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    toplamTutar: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    paraBirimi: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    durum: {
      type: DataTypes.STRING,
      defaultValue: 'Draft'
    },
    onayGerekli: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    onayNedeni: {
      type: DataTypes.STRING,
      allowNull: true
    },
    yoneticiNotlari: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ilgiliKisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    iletisimBilgisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    faturaAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sevkAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    istenenTerminTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    teslimatSekli: {
      type: DataTypes.STRING,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    contactPerson: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('ilgiliKisi'); }
    },
    contactInfo: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('iletisimBilgisi'); }
    },
    billingAddress: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('faturaAdresi'); }
    },
    shippingAddress: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('sevkAdresi'); }
    },
    requestedDeliveryDate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('istenenTerminTarihi'); }
    },
    deliveryTerms: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('teslimatSekli'); }
    },
    quotationNo: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('teklifNo'); }
    },
    customerName: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('musteriAdi') || (this.musteri ? (this.musteri.firmaAdi || this.musteri.companyName) : ''); }
    },
    customerId: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('musteriId'); }
    },
    quotationDate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('teklifTarihi'); }
    },
    validUntil: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('gecerlilikBitis'); }
    },
    itemsJson: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('kalemlerJson'); }
    },
    quantity: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('miktar'); }
    },
    unitPrice: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('birimFiyat'); }
    },
    discountRate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('iskontoOrani'); }
    },
    taxRate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('kdvOrani'); }
    },
    subtotal: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('araToplam'); }
    },
    discountAmount: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('iskontoTutari'); }
    },
    taxAmount: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('kdvTutari'); }
    },
    totalAmount: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('toplamTutar'); }
    },
    currency: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('paraBirimi'); }
    },
    status: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('durum'); }
    },
    requiresApproval: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('onayGerekli'); }
    },
    approvalReason: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('onayNedeni'); }
    },
    managerNotes: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('yoneticiNotlari'); }
    },
    notes: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('notlar'); }
    },
    stockItem: {
      type: DataTypes.VIRTUAL,
      get() { return this.stokKarti; }
    },
    customer: {
      type: DataTypes.VIRTUAL,
      get() { return this.musteri; }
    }
  }, {
    sequelize,
    modelName: 'SatisTeklifi',
    tableName: 'SatisTeklifleri'
  });

  return SatisTeklifi;
};
