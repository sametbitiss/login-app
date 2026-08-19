'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatisFaturasi extends Model {
    static associate(models) {
      SatisFaturasi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatisFaturasi.belongsTo(models.SatisSiparisi, { foreignKey: 'satisSiparisId', as: 'satisSiparisi' });
      SatisFaturasi.belongsTo(models.SatisIrsaliyesi, { foreignKey: 'irsaliyeId', as: 'satisIrsaliyesi' });
      SatisFaturasi.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
    }
  }

  SatisFaturasi.init({
    faturaNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    satisSiparisId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    irsaliyeId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    musteriId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    musteriAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    musteriVergiDairesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    faturaAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    teslimatAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    musteriTelefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    musteriEposta: {
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
    vadeTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    faturaTuru: {
      type: DataTypes.STRING,
      defaultValue: 'SATIS'
    },
    faturaSenaryosu: {
      type: DataTypes.STRING,
      defaultValue: 'EARSIVFATURA'
    },
    ettnNo: {
      type: DataTypes.STRING,
      allowNull: true
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
    dovizKuru: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 1.0000
    },
    odemeTuru: {
      type: DataTypes.STRING,
      defaultValue: 'Vadeli'
    },
    vadeGunu: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    bankaAdi: {
      type: DataTypes.STRING,
      defaultValue: 'Ziraat Bankası A.Ş. - Maslak Şubesi'
    },
    ibanNo: {
      type: DataTypes.STRING,
      defaultValue: 'TR56 0001 0002 0003 0004 0005 06'
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
    modelName: 'SatisFaturasi',
    tableName: 'SatisFaturalari'
  });

  return SatisFaturasi;
};
