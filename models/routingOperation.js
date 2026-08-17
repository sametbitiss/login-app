'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class RoutingOperation extends Model {
    static associate(models) {
      RoutingOperation.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
    }
  }

  RoutingOperation.init({
    routingCode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    operationSeq: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    operationCode: {
      type: DataTypes.STRING,
      allowNull: true
    },
    operationName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    workCenter: {
      type: DataTypes.STRING,
      allowNull: false
    },
    setupTimeMinutes: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 15.0
    },
    runTimeMinutesPerUnit: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 5.0
    },
    operatorCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    instructions: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    usedComponents: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'RoutingOperation',
    tableName: 'RoutingOperations'
  });

  return RoutingOperation;
};
