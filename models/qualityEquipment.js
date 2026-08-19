'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class KaliteEkipmani extends Model {
    static associate(models) {
      // associations if any
    }
  }

  KaliteEkipmani.init({
    ekipmanKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    ad: {
      type: DataTypes.STRING,
      allowNull: false
    },
    kategori: {
      type: DataTypes.ENUM('Dimension', 'Weight', 'Temperature', 'Electrical', 'Pressure'),
      allowNull: false,
      defaultValue: 'Dimension'
    },
    markaModel: {
      type: DataTypes.STRING,
      allowNull: true
    },
    seriNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kalibrasyonPeriyoduAy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 12
    },
    sonKalibrasyonTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gelecekKalibrasyonTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('Valid', 'Due_Soon', 'Expired', 'In_Maintenance'),
      allowNull: false,
      defaultValue: 'Valid'
    },
    kalibrasyonLaboratuvari: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'KaliteEkipmani',
    tableName: 'KaliteEkipmanlari'
  });

  return KaliteEkipmani;
};
