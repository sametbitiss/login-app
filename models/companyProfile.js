'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SirketProfili extends Model {}

  SirketProfili.init({
    unvan: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ENTERPRISE ERP A.Ş.'
    },
    markaAdi: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'ENTERPRISE ERP'
    },
    vergiDairesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vergiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    mersisNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    ticaretSicilNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    telefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    eposta: {
      type: DataTypes.STRING,
      allowNull: true
    },
    webSitesi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    adres: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    bankaBilgileri: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'SirketProfili',
    tableName: 'SirketProfili'
  });

  return SirketProfili;
};
