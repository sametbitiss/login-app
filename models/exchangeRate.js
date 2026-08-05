'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ExchangeRate extends Model {
    static associate(models) {
      ExchangeRate.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    }
  }

  ExchangeRate.init({
    currencyCode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rateToTRY: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 1.0000
    },
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    source: {
      type: DataTypes.STRING,
      defaultValue: 'TCMB'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'ExchangeRate',
    tableName: 'ExchangeRates'
  });

  return ExchangeRate;
};
