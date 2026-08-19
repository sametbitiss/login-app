'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatinAlmaFaturasi extends Model {
    static associate(models) {
      SatinAlmaFaturasi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatinAlmaFaturasi.belongsTo(models.SatinAlmaSiparisi, { foreignKey: 'satinAlmaSiparisId', as: 'satinAlmaSiparisi' });
      SatinAlmaFaturasi.belongsTo(models.Tedarikci, { foreignKey: 'tedarikciId', as: 'tedarikci' });
    }
  }

  SatinAlmaFaturasi.init({
    faturaNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    satinAlmaSiparisId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tedarikciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    tedarikciAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tedarikciVergiDairesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciVergiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    faturaAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tedarikciTelefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciEposta: {
      type: DataTypes.STRING,
      allowNull: true
    },
    faturaTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    faturaSaati: {
      type: DataTypes.STRING,
      defaultValue: '10:30:00'
    },
    faturaTuru: {
      type: DataTypes.STRING,
      defaultValue: 'SATIN_ALMA'
    },
    siparisNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    siparisTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    irsaliyeNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    irsaliyeTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    bankaAdi: {
      type: DataTypes.STRING,
      defaultValue: 'T.C. Ziraat Bankası A.Ş.'
    },
    ibanNo: {
      type: DataTypes.STRING,
      defaultValue: 'TR62 0001 0000 0000 0000 1234 56'
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
    odemeVadesi: {
      type: DataTypes.STRING,
      defaultValue: 'Vadeli_30'
    },
    odemeDurumu: {
      type: DataTypes.STRING,
      defaultValue: 'Unpaid'
    },
    durum: {
      type: DataTypes.STRING,
      defaultValue: 'Issued'
    },
    kalemlerJson: {
      type: DataTypes.TEXT,
      allowNull: true
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
    modelName: 'SatinAlmaFaturasi',
    tableName: 'SatinAlmaFaturalari'
  });

  return SatinAlmaFaturasi;
};
