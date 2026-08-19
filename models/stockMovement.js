'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StokHareketi extends Model {
    static associate(models) {
      StokHareketi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      StokHareketi.belongsTo(models.Depo, { foreignKey: 'cikisDepoId', as: 'cikisDepo' });
      StokHareketi.belongsTo(models.Depo, { foreignKey: 'varisDepoId', as: 'varisDepo' });
      StokHareketi.belongsTo(models.Kullanici, { foreignKey: 'yapanKullaniciId', as: 'kullanici' });
    }
  }

  StokHareketi.init({
    hareketNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cikisDepoId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    varisDepoId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    hareketTuru: {
      type: DataTypes.STRING,
      allowNull: false
    },
    miktar: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    birim: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    birimFiyat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    },
    referansNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notlar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    yapanKullaniciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'StokHareketi',
    tableName: 'StokHareketleri'
  });

  return StokHareketi;
};
