'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QualityInspection extends Model {
    static associate(models) {
      QualityInspection.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      QualityInspection.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
      QualityInspection.belongsTo(models.ProductionOrder, { foreignKey: 'productionOrderId', as: 'productionOrder' });
    }
  }

  QualityInspection.init({
    inspectionNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    type: {
      type: DataTypes.ENUM('Incoming', 'InProcess', 'Final'),
      allowNull: false,
      defaultValue: 'Incoming'
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    lotNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    productionOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sampleSize: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    passedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    rejectedQuantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    decision: {
      type: DataTypes.ENUM('Accepted', 'Conditional_Accept', 'Rejected'),
      allowNull: false,
      defaultValue: 'Accepted'
    },
    inspectorName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    defectCategory: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    inspectedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'QualityInspection',
    tableName: 'QualityInspections'
  });

  return QualityInspection;
};
