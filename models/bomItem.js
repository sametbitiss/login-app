'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UrunRecetesi extends Model {
    static associate(models) {
      UrunRecetesi.belongsTo(models.StokKarti, { foreignKey: 'mamulStokId', as: 'mamulUrun' });
      UrunRecetesi.belongsTo(models.StokKarti, { foreignKey: 'bilesenStokId', as: 'bilesenUrun' });
      UrunRecetesi.belongsTo(models.StokKarti, { foreignKey: 'alternatifBilesenStokId', as: 'alternatifBilesenUrun' });
    }
  }

  UrunRecetesi.init({
    receteKodu: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mamulStokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    bilesenStokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    versiyon: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Rev.01'
    },
    bazMiktar: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 1.0
    },
    gerekliMiktar: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 1.0
    },
    birim: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    fireOrani: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    seviye: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    operasyonKodu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    alternatifBilesenStokId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    alternatifNotlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'UrunRecetesi',
    tableName: 'UrunReceteleri'
  });

  return UrunRecetesi;
};
