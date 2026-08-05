'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class ProductionOrder extends Model {
    static associate(models) {
      ProductionOrder.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      ProductionOrder.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
    }
  }

  ProductionOrder.init({
    workOrderNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    productionTitle: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    plannedQuantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 1
    },
    completedQuantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    scrapQuantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    status: {
      type: DataTypes.ENUM('Planned', 'Approved', 'In_Production', 'Quality_Check', 'Completed', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Planned'
    },
    priority: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Urgent'),
      allowNull: false,
      defaultValue: 'Normal'
    },
    workCenter: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'İstasyon-1 (Genel Montaj)'
    },
    plannedStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    plannedEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    actualStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    actualEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    estimatedHours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: 0
    },
    actualHours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: 0
    },
    bomNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    productionManager: {
      type: DataTypes.STRING,
      allowNull: true
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
    modelName: 'ProductionOrder',
    tableName: 'ProductionOrders'
  });

  return ProductionOrder;
};
