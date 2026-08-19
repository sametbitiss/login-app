'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StokPartisi extends Model {
    static associate(models) {
      StokPartisi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      StokPartisi.belongsTo(models.Depo, { foreignKey: 'depoId', as: 'depo' });
    }
  }

  StokPartisi.init({
    partiNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    seriNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    depoId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    miktar: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    uretimTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    sonKullanmaTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    kaliteDurumu: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Approved'
    },
    notlar: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'StokPartisi',
    tableName: 'StokPartileri'
  });

  return StokPartisi;
};
