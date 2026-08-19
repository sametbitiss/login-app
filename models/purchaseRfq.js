'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatinAlmaTeklifTalebi extends Model {
    static associate(models) {
      SatinAlmaTeklifTalebi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatinAlmaTeklifTalebi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      SatinAlmaTeklifTalebi.belongsTo(models.Tedarikci, { foreignKey: 'tedarikciId', as: 'tedarikci' });
    }
  }

  SatinAlmaTeklifTalebi.init({
    teklifTalepNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    tedarikciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tedarikciAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    talepEdilenMiktar: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 1
    },
    teklifEdilenBirimFiyat: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    teklifEdilenToplamFiyat: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    paraBirimi: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    teslimSuresiGun: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    odemeVadesi: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: true
    },
    gecerlilikBitis: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    kaliteNotu: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('Draft', 'Sent', 'Received', 'Accepted', 'Rejected', 'Expired'),
      allowNull: false,
      defaultValue: 'Draft'
    },
    kazananMi: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    teklifTalepTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    teslimYeri: {
      type: DataTypes.STRING,
      allowNull: true
    },
    sevkiyatDurumu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kdvDurumu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    belgeReferansi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    araToplam: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    toplamIskonto: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    toplamKdv: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    kalemlerVerisi: {
      type: DataTypes.JSON,
      allowNull: true
    },
    talepEden: {
      type: DataTypes.STRING,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'SatinAlmaTeklifTalebi',
    tableName: 'SatinAlmaTeklifTalepleri'
  });

  return SatinAlmaTeklifTalebi;
};
