'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatinAlmaSiparisi extends Model {
    static associate(models) {
      SatinAlmaSiparisi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatinAlmaSiparisi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      SatinAlmaSiparisi.belongsTo(models.Tedarikci, { foreignKey: 'tedarikciId', as: 'tedarikci' });
      SatinAlmaSiparisi.hasMany(models.MalKabul, { foreignKey: 'satinAlmaSiparisId', as: 'malKabulleri' });
    }
  }

  SatinAlmaSiparisi.init({
    siparisNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    tedarikciAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tedarikciVergiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciIlgiliKisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciEposta: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciTelefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    siparisTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    beklenenTeslimTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    odemeVadesi: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: false,
      defaultValue: 'Pesin'
    },
    durum: {
      type: DataTypes.ENUM('Draft', 'Pending_Approval', 'Ordered', 'Partial_Received', 'Received', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Pending_Approval'
    },
    oncelik: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Urgent'),
      allowNull: false,
      defaultValue: 'Normal'
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    teslimDeposu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    satinAlmaci: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kalemlerJson: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    dovizKuru: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 1
    },
    toplamTutarTRY: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    kurKilitliMi: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    },
    kurTarihi: {
      type: DataTypes.DATE,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'SatinAlmaSiparisi',
    tableName: 'SatinAlmaSiparisleri'
  });

  return SatinAlmaSiparisi;
};
