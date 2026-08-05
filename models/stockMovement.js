'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockMovement extends Model {
    static associate(models) {
      StockMovement.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      StockMovement.belongsTo(models.Warehouse, { foreignKey: 'sourceWarehouseId', as: 'sourceWarehouse' });
      StockMovement.belongsTo(models.Warehouse, { foreignKey: 'targetWarehouseId', as: 'targetWarehouse' });
      StockMovement.belongsTo(models.User, { foreignKey: 'performedBy', as: 'user' });
    }
  }

  StockMovement.init({
    movementNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sourceWarehouseId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    targetWarehouseId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    movementType: {
      type: DataTypes.STRING,
      allowNull: false // In, Out, Transfer, Adjustment, Scrap
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0
    },
    referenceNo: {
      type: DataTypes.STRING,
      allowNull: true
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
    modelName: 'StockMovement',
    tableName: 'StockMovements'
  });

  return StockMovement;
};
