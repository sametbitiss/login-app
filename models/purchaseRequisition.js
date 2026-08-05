'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseRequisition extends Model {
    static associate(models) {
      PurchaseRequisition.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      PurchaseRequisition.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    }
  }

  PurchaseRequisition.init({
    requisitionNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    sourceModule: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Stock' // Stock or Production
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    requestedQuantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 1.0
    },
    unit: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    urgency: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Normal' // Low, Normal, High, Urgent
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Pending' // Pending, Approved, Ordered, Rejected
    },
    requesterName: {
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
    modelName: 'PurchaseRequisition',
    tableName: 'PurchaseRequisitions'
  });

  return PurchaseRequisition;
};
