'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RotaOperasyon extends Model {
    static associate(models) {
      RotaOperasyon.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      RotaOperasyon.belongsTo(models.IsMerkezi, { foreignKey: 'isMerkeziId', as: 'isMerkeziKarti' });
    }
  }

  RotaOperasyon.init({
    rotaKodu: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    operasyonSira: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    operasyonKodu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    operasyonAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    isMerkeziId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    isMerkezi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    hazirlikSuresiDakika: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 15.0
    },
    calismaSuresiDakikaBirim: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 5.0
    },
    operatorSayisi: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    },
    talimatlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kullanilanBilesenler: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'RotaOperasyon',
    tableName: 'RotaOperasyonlari'
  });

  return RotaOperasyon;
};
