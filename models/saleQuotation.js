'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SaleQuotation extends Model {
    static associate(models) {
      SaleQuotation.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      SaleQuotation.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      SaleQuotation.belongsTo(models.CustomerAccount, { foreignKey: 'customerId', as: 'customer' });
    }
  }

  SaleQuotation.init({
    quotationNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    quotationDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    validUntil: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    itemsJson: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.0
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    discountRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 20.00
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Draft'
    },
    approvalNeeded: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    approvalReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    managerNotes: {
      type: DataTypes.TEXT,
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
    modelName: 'SaleQuotation',
    tableName: 'SaleQuotations'
  });

  return SaleQuotation;
};
