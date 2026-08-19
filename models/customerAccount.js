'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MusteriHesabi extends Model {
    static associate(models) {
      MusteriHesabi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      MusteriHesabi.hasMany(models.SatisSiparisi, { foreignKey: 'musteriId', as: 'siparisler' });
      MusteriHesabi.hasMany(models.SatisTeklifi, { foreignKey: 'musteriId', as: 'teklifler' });
      MusteriHesabi.hasMany(models.MusteriFiyatListesi, { foreignKey: 'musteriId', as: 'fiyatListeleri' });
      MusteriHesabi.hasMany(models.MusteriCariHareket, { foreignKey: 'musteriId', as: 'cariHareketler' });
    }
  }

  MusteriHesabi.init({
    musteriKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    firmaAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    vergiDairesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vergiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ilgiliKisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    eposta: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    adres: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sehir: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ulke: {
      type: DataTypes.STRING,
      defaultValue: 'Türkiye'
    },
    krediLimiti: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 100000.00
    },
    guncelBakiye: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    vadeGunu: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    riskSeviyesi: {
      type: DataTypes.STRING,
      defaultValue: 'Low'
    },
    musteriSkoru: {
      type: DataTypes.INTEGER,
      defaultValue: 85,
      allowNull: false
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
    }
  }, {
    sequelize,
    modelName: 'MusteriHesabi',
    tableName: 'MusteriHesaplari'
  });

  return MusteriHesabi;
};
