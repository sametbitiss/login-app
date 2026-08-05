'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockCounting extends Model {
    static associate(models) {
      StockCounting.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
      StockCounting.belongsTo(models.User, { foreignKey: 'performedBy', as: 'user' });
    }
  }

  StockCounting.init({
    countNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    countDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Completed' // Draft, In_Progress, Completed, Adjusted
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true
    },
    performedBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'StockCounting',
    tableName: 'StockCountings'
  });

  return StockCounting;
};
