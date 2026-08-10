'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SaleOrder extends Model {
    static associate(models) {
      SaleOrder.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      SaleOrder.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      SaleOrder.belongsTo(models.CustomerAccount, { foreignKey: 'customerId', as: 'customer' });
    }
  }

  SaleOrder.init({
    orderNo: {
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
    customerTaxNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    customerPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    orderDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    paymentTerm: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: false,
      defaultValue: 'Pesin'
    },
    status: {
      type: DataTypes.ENUM('Pending_Approval', 'Approved', 'Preparing', 'Shipped', 'Completed', 'Cancelled', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending_Approval'
    },
    fulfillmentStatus: {
      type: DataTypes.STRING,
      defaultValue: 'Open'
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
    priority: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Urgent'),
      allowNull: false,
      defaultValue: 'Normal'
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
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 1
    },
    unitPrice: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    discountRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 20
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    discountAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    taxAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    totalAmount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    billingAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    salesRep: {
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
    modelName: 'SaleOrder',
    tableName: 'SaleOrders'
  });

  return SaleOrder;
};
