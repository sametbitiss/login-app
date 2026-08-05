'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CustomerPriceList extends Model {
    static associate(models) {
      CustomerPriceList.belongsTo(models.CustomerAccount, { foreignKey: 'customerId', as: 'customer' });
      CustomerPriceList.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      CustomerPriceList.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    }
  }

  CustomerPriceList.init({
    listName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true // Null means global special price list
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    specialPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    customDiscountRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    validFrom: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    validUntil: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Active'
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
    modelName: 'CustomerPriceList',
    tableName: 'CustomerPriceLists'
  });

  return CustomerPriceList;
};
