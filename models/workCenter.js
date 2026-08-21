'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class IsMerkezi extends Model {
    static associate(models) {
      IsMerkezi.belongsTo(models.Atolye, { foreignKey: 'atolyeId', as: 'atolye' });
      IsMerkezi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
    }
  }

  IsMerkezi.init({
    isMerkeziKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    isMerkeziAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    atolyeId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    gunlukCalismaSaati: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 8.00
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    },
    varsayilanIsciSayisi: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'IsMerkezi',
    tableName: 'IsMerkezleri'
  });

  return IsMerkezi;
};
