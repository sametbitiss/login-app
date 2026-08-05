'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class BOMItem extends Model {
    static associate(models) {
      BOMItem.belongsTo(models.StockItem, { foreignKey: 'finishedStockItemId', as: 'finishedProduct' });
      BOMItem.belongsTo(models.StockItem, { foreignKey: 'componentStockItemId', as: 'componentItem' });
    }
  }

  BOMItem.init({
    bomCode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    finishedStockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    componentStockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    quantityRequired: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 1.0
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    scrapPercentage: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0
    },
    notes: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'BOMItem',
    tableName: 'BOMItems'
  });

  return BOMItem;
};
