'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SistemAyari extends Model {}

  SistemAyari.init({
    anahtar: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    deger: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    aciklama: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kategori: {
      type: DataTypes.STRING,
      defaultValue: 'General'
    }
  }, {
    sequelize,
    modelName: 'SistemAyari',
    tableName: 'SistemAyarlari'
  });

  return SistemAyari;
};
