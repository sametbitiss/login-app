'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class GoodsReceipt extends Model {
    static associate(models) {
      GoodsReceipt.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      GoodsReceipt.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
      GoodsReceipt.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      GoodsReceipt.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    }
  }

  GoodsReceipt.init({
    grnNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    purchaseOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    orderedQuantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    receivedQuantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    acceptedQuantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    rejectedQuantity: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    receiptDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    deliveryNoteNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deliveryNoteDate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deliveryNotePhoto: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    itemsData: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    qualityStatus: {
      type: DataTypes.ENUM('Pending_Inspection', 'Approved', 'Partial_Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending_Inspection'
    },
    inspectorName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    qualityNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    warehouseLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('Pending', 'Completed', 'Partial', 'Returned'),
      allowNull: false,
      defaultValue: 'Pending'
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
    modelName: 'GoodsReceipt',
    tableName: 'GoodsReceipts'
  });

  return GoodsReceipt;
};
