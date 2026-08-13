'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseOrder extends Model {
    static associate(models) {
      PurchaseOrder.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      PurchaseOrder.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      PurchaseOrder.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      PurchaseOrder.hasMany(models.GoodsReceipt, { foreignKey: 'purchaseOrderId', as: 'goodsReceipts' });
    }
  }

  PurchaseOrder.init({
    orderNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    supplierName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    supplierTaxNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierContactPerson: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    orderDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    expectedDeliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    paymentTerm: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: false,
      defaultValue: 'Pesin'
    },
    status: {
      type: DataTypes.ENUM('Draft', 'Pending_Approval', 'Ordered', 'Partial_Received', 'Received', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Pending_Approval'
    },
    priority: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Urgent'),
      allowNull: false,
      defaultValue: 'Normal'
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    deliveryWarehouse: {
      type: DataTypes.STRING,
      allowNull: true
    },
    purchasingAgent: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    itemsJson: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PurchaseOrder',
    tableName: 'PurchaseOrders'
  });

  return PurchaseOrder;
};
