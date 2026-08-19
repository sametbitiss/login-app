'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StokLokasyonu extends Model {
    static associate(models) {
      StokLokasyonu.belongsTo(models.Depo, { foreignKey: 'depoId', as: 'depo' });
    }
  }

  StokLokasyonu.init({
    lokasyonKodu: {
      type: DataTypes.STRING,
      allowNull: false
    },
    depoId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    koridor: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Koridor-A'
    },
    raf: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Raf-01'
    },
    goz: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Göz-01'
    },
    kapasite: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    }
  }, {
    sequelize,
    modelName: 'StokLokasyonu',
    tableName: 'StokLokasyonlari'
  });

  return StokLokasyonu;
};
