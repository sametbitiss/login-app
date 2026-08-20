'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatisSiparisi extends Model {
    static associate(models) {
      SatisSiparisi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatisSiparisi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      SatisSiparisi.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
    }
  }

  SatisSiparisi.init({
    siparisNo: {
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
    musteriVergiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    musteriEposta: {
      type: DataTypes.STRING,
      allowNull: true
    },
    musteriTelefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    siparisTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    teslimTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    odemeVadesi: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: false,
      defaultValue: 'Pesin'
    },
    durum: {
      type: DataTypes.ENUM('Pending_Approval', 'Approved', 'Preparing', 'Shipped', 'Completed', 'Cancelled', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending_Approval'
    },
    karsilanmaDurumu: {
      type: DataTypes.STRING,
      defaultValue: 'Open'
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
    oncelik: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Urgent'),
      allowNull: false,
      defaultValue: 'Normal'
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
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 1
    },
    birimFiyat: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    iskontoOrani: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    kdvOrani: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 20
    },
    araToplam: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    iskontoTutari: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    kdvTutari: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    toplamTutar: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    paraBirimi: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    teslimatAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    faturaAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    satisTemsilcisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    orderNo: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('siparisNo'); }
    },
    customerName: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('musteriAdi') || (this.musteri ? (this.musteri.firmaAdi || this.musteri.companyName) : ''); }
    },
    customerId: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('musteriId'); }
    },
    orderDate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('siparisTarihi'); }
    },
    deliveryDate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('teslimTarihi'); }
    },
    paymentTerm: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('odemeVadesi'); }
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
    fulfillmentStatus: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('karsilanmaDurumu'); }
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
    modelName: 'SatisSiparisi',
    tableName: 'SatisSiparisleri'
  });

  return SatisSiparisi;
};
