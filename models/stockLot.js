'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockLot extends Model {
    static associate(models) {
      StockLot.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      StockLot.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    }
  }

  StockLot.init({
    lotNumber: {
      type: DataTypes.STRING,
      allowNull: false
    },
    serialNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    productionDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    expirationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    qualityStatus: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Approved' // Approved, Quarantine, Rejected
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'StockLot',
    tableName: 'StockLots'
  });

  return StockLot;
};
