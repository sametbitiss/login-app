'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Tedarikci extends Model {
    static associate(models) {
      Tedarikci.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      Tedarikci.hasMany(models.StokKarti, { foreignKey: 'tedarikciId', as: 'stokKartlari' });
      Tedarikci.hasMany(models.SatinAlmaSiparisi, { foreignKey: 'tedarikciId', as: 'satinAlmaSiparisleri' });
      Tedarikci.hasMany(models.SatinAlmaTeklifTalebi, { foreignKey: 'tedarikciId', as: 'teklifTalepleri' });
      Tedarikci.hasMany(models.MalKabul, { foreignKey: 'tedarikciId', as: 'malKabulleri' });
    }
  }

  Tedarikci.init({
    tedarikciKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    firmaAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ticariAd: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vergiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vergiDairesi: {
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
    gsm: {
      type: DataTypes.STRING,
      allowNull: true
    },
    faks: {
      type: DataTypes.STRING,
      allowNull: true
    },
    webSitesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    bankaBilgileri: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    teslimatSekli: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'DAP - Adrese / Fabrikaya Teslim'
    },
    terminSuresi: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 7
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
      allowNull: true,
      defaultValue: 'Türkiye'
    },
    odemeVadesi: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: false,
      defaultValue: 'Vadeli_30'
    },
    paraBirimi: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    riskLimiti: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 100000
    },
    guncelBakiye: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    kategori: {
      type: DataTypes.ENUM('Hammadde', 'Yari_Mamul', 'Hizmet', 'Yedek_Parca', 'Ambalaj', 'Diger'),
      allowNull: true,
      defaultValue: 'Diger'
    },
    performansSkoru: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: false,
      defaultValue: 0
    },
    zamanindaTeslimatOrani: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    kaliteSkoru: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    toplamSiparisSayisi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    toplamHarcama: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    durum: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Blacklisted'),
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
    }
  }, {
    sequelize,
    modelName: 'Tedarikci',
    tableName: 'Tedarikciler'
  });

  return Tedarikci;
};
