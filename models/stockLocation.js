'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockLocation extends Model {
    static associate(models) {
      StockLocation.belongsTo(models.Warehouse, { foreignKey: 'warehouseId', as: 'warehouse' });
    }
  }

  StockLocation.init({
    locationCode: {
      type: DataTypes.STRING,
      allowNull: false
    },
    warehouseId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    aisle: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Koridor-A'
    },
    shelf: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Raf-01'
    },
    bin: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Göz-01'
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    }
  }, {
    sequelize,
    modelName: 'StockLocation',
    tableName: 'StockLocations'
  });

  return StockLocation;
};
