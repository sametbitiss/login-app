'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Warehouse extends Model {
    static associate(models) {
      Warehouse.hasMany(models.StockLocation, { foreignKey: 'warehouseId', as: 'locations' });
      Warehouse.hasMany(models.StockLot, { foreignKey: 'warehouseId', as: 'lots' });
    }
  }

  Warehouse.init({
    warehouseCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'General' // Hammadde, Mamul, Yedek_Parca, Sevkiyat, General
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'İstanbul'
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    managerName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Active'
    }
  }, {
    sequelize,
    modelName: 'Warehouse',
    tableName: 'Warehouses'
  });

  return Warehouse;
};
