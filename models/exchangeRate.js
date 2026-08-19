'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DovizKuru extends Model {
    static associate(models) {
      DovizKuru.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
    }
  }

  DovizKuru.init({
    dovizKodu: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tryKuru: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 1.0000
    },
    gecerlilikTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    kaynak: {
      type: DataTypes.STRING,
      defaultValue: 'TCMB'
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
    modelName: 'DovizKuru',
    tableName: 'DovizKurlari'
  });

  return DovizKuru;
};
