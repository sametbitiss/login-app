'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StokKarti extends Model {
    static associate(models) {
      StokKarti.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      StokKarti.hasMany(models.RotaOperasyon, { foreignKey: 'stokId', as: 'rotaOperasyonlari' });
      StokKarti.hasMany(models.UrunRecetesi, { foreignKey: 'mamulStokId', as: 'receteler' });
    }
  }

  StokKarti.init({
    stokKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    barkod: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    ad: {
      type: DataTypes.STRING,
      allowNull: false
    },
    aciklama: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kategori: {
      type: DataTypes.ENUM('Hammadde', 'Yari_Mamul', 'Yarı_Mamul', 'Mamul', 'Diger'),
      allowNull: false,
      defaultValue: 'Hammadde'
    },
    tedarikYontemi: {
      type: DataTypes.ENUM('Satın Alma', 'Üretim', 'Purchase', 'Production'),
      allowNull: false,
      defaultValue: 'Satın Alma'
    },
    birim: {
      type: DataTypes.ENUM('Adet', 'Kg', 'Lt', 'Mt', 'M2', 'M3', 'Paket', 'Koli', 'Ton', 'Set'),
      allowNull: false,
      defaultValue: 'Adet'
    },
    marka: {
      type: DataTypes.STRING,
      allowNull: true
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true
    },
    mevcutStok: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    rezerveStok: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    minStok: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    maxStok: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    alisFiyati: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    satisFiyati: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    paraBirimi: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    kdvOrani: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 20.00
    },
    depoLokasyonu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikci: {
      type: DataTypes.STRING,
      allowNull: true
    },
    rafOmru: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    agirlik: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    boyutlar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('Active', 'Passive', 'Discontinued'),
      allowNull: false,
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
    stockCode: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('stokKodu'); }
    },
    name: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('ad'); }
    },
    salePrice: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('satisFiyati'); }
    },
    currentStock: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('mevcutStok'); }
    },
    unit: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('birim'); }
    },
    category: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('kategori'); }
    },
    taxRate: {
      type: DataTypes.VIRTUAL,
      get() { return this.getDataValue('kdvOrani'); }
    }
  }, {
    sequelize,
    modelName: 'StokKarti',
    tableName: 'StokKartlari'
  });

  return StokKarti;
};
