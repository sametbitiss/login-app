'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class KaliteDokumani extends Model {
    static associate(models) {
      // associations if any
    }
  }

  KaliteDokumani.init({
    dokumanKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    baslik: {
      type: DataTypes.STRING,
      allowNull: false
    },
    kategori: {
      type: DataTypes.ENUM('Procedure', 'Instruction', 'Form', 'Quality_Manual'),
      allowNull: false,
      defaultValue: 'Procedure'
    },
    revizyonNo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Rev.01'
    },
    gecerlilikTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    sorumlu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('Active', 'Draft', 'Obsolete'),
      allowNull: false,
      defaultValue: 'Active'
    },
    dosyaYolu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    aciklama: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'KaliteDokumani',
    tableName: 'KaliteDokumanlari'
  });

  return KaliteDokumani;
};
