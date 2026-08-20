'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MusteriFiyatListesi extends Model {
    static associate(models) {
      MusteriFiyatListesi.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
      MusteriFiyatListesi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      MusteriFiyatListesi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
    }
  }

  MusteriFiyatListesi.init({
    listeAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    musteriId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    ozelFiyat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    ozelIskontoOrani: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    paraBirimi: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    gecerlilikBaslangic: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gecerlilikBitis: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    durum: {
      type: DataTypes.STRING,
      defaultValue: 'Active'
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    listName: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('listeAdi'); }
    },
    customerId: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('musteriId'); }
    },
    stockId: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('stokId'); }
    },
    stockItemId: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('stokId'); }
    },
    specialPrice: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('ozelFiyat'); }
    },
    customDiscountRate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('ozelIskontoOrani'); }
    },
    currency: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('paraBirimi'); }
    },
    validFrom: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('gecerlilikBaslangic'); }
    },
    validUntil: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('gecerlilikBitis'); }
    },
    status: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('durum'); }
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
    modelName: 'MusteriFiyatListesi',
    tableName: 'MusteriFiyatListeleri'
  });

  return MusteriFiyatListesi;
};
