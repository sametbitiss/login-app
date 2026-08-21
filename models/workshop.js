'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Atolye extends Model {
    static associate(models) {
      Atolye.belongsTo(models.Kullanici, { foreignKey: 'sorumluId', as: 'sorumlu' });
      Atolye.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
    }
  }

  Atolye.init({
    atolyeKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    atolyeAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    sorumluId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    },
    aciklama: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Atolye',
    tableName: 'Atolyeler'
  });

  return Atolye;
};
