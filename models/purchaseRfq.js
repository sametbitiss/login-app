'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseRfq extends Model {
    static associate(models) {
      PurchaseRfq.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      PurchaseRfq.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      PurchaseRfq.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    }
  }

  PurchaseRfq.init({
    rfqNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    supplierName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    requestedQuantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 1
    },
    offeredUnitPrice: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    offeredTotalPrice: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    currency: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    deliveryDays: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    paymentTerm: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: true
    },
    validUntil: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    qualityNote: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('Draft', 'Sent', 'Received', 'Accepted', 'Rejected', 'Expired'),
      allowNull: false,
      defaultValue: 'Draft'
    },
    isWinner: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    rfqDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    deliveryPlace: {
      type: DataTypes.STRING,
      allowNull: true
    },
    shippingStatus: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vatStatus: {
      type: DataTypes.STRING,
      allowNull: true
    },
    documentRef: {
      type: DataTypes.STRING,
      allowNull: true
    },
    subtotal: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    totalDiscount: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    totalTax: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    itemsData: {
      type: DataTypes.JSON,
      allowNull: true
    },
    requestedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'PurchaseRfq',
    tableName: 'PurchaseRfqs'
  });

  return PurchaseRfq;
};
