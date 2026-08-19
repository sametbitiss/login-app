'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatinAlmaTalebi extends Model {
    static associate(models) {
      SatinAlmaTalebi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      SatinAlmaTalebi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
    }
  }

  SatinAlmaTalebi.init({
    talepNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    kaynakModul: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Stock'
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    talepEdilenMiktar: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 1.0
    },
    birim: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    aciliyet: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Normal'
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Pending'
    },
    talepEdenAdi: {
      type: DataTypes.STRING,
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
    modelName: 'SatinAlmaTalebi',
    tableName: 'SatinAlmaTalepleri'
  });

  return SatinAlmaTalebi;
};
