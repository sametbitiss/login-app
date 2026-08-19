'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Depo extends Model {
    static associate(models) {
      Depo.hasMany(models.StokLokasyonu, { foreignKey: 'depoId', as: 'lokasyonlar' });
      Depo.hasMany(models.StokPartisi, { foreignKey: 'depoId', as: 'partiler' });
    }
  }

  Depo.init({
    depoKodu: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    ad: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tur: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'General'
    },
    sehir: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'İstanbul'
    },
    adres: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    sorumluAdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    },
    kalemlerJson: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Depo',
    tableName: 'Depolar'
  });

  return Depo;
};
