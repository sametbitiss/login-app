'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatisIrsaliyesi extends Model {
    static associate(models) {
      SatisIrsaliyesi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatisIrsaliyesi.belongsTo(models.SatisSiparisi, { foreignKey: 'satisSiparisId', as: 'satisSiparisi' });
      SatisIrsaliyesi.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
    }
  }

  SatisIrsaliyesi.init({
    irsaliyeNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    irsaliyeTuru: {
      type: DataTypes.STRING,
      defaultValue: 'Satış İrsaliyesi'
    },
    satisSiparisId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    musteriId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    musteriAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    irsaliyeTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    sevkiyatTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    cikisDeposu: {
      type: DataTypes.STRING,
      defaultValue: 'Merkez Lojistik Deposu'
    },
    tasiyiciFirma: {
      type: DataTypes.STRING,
      allowNull: true
    },
    aracPlakasi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    surucuAdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    takipNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    teslimatAdresi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    teslimatSehri: {
      type: DataTypes.STRING,
      allowNull: true
    },
    teslimatIlcesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    aliciKisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    teslimatTuru: {
      type: DataTypes.STRING,
      allowNull: true
    },
    projeNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.STRING,
      defaultValue: 'Dispatched'
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kalemlerJson: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'SatisIrsaliyesi',
    tableName: 'SatisIrsaliyeleri'
  });

  return SatisIrsaliyesi;
};
