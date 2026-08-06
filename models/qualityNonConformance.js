'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QualityNonConformance extends Model {
    static associate(models) {
      QualityNonConformance.belongsTo(models.StockItem, { foreignKey: 'stockItemId', as: 'stockItem' });
      QualityNonConformance.hasMany(models.QualityCapa, { foreignKey: 'ncrId', as: 'capas' });
    }
  }

  QualityNonConformance.init({
    ncrNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    type: {
      type: DataTypes.ENUM('Material', 'Process', 'Customer_Return', 'Supplier_Defect'),
      allowNull: false,
      defaultValue: 'Material'
    },
    severity: {
      type: DataTypes.ENUM('Critical', 'Major', 'Minor'),
      allowNull: false,
      defaultValue: 'Major'
    },
    status: {
      type: DataTypes.ENUM('Open', 'Under_Investigation', 'Action_Required', 'Closed'),
      allowNull: false,
      defaultValue: 'Open'
    },
    stockItemId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    lotNumber: {
      type: DataTypes.STRING,
      allowNull: true
    },
    quantityAffected: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    detectedBy: {
      type: DataTypes.STRING,
      allowNull: true
    },
    assignedTo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    disposition: {
      type: DataTypes.ENUM('Scrap', 'Rework', 'ReturnToSupplier', 'UseAsIs'),
      allowNull: false,
      defaultValue: 'Rework'
    }
  }, {
    sequelize,
    modelName: 'QualityNonConformance',
    tableName: 'QualityNonConformances'
  });

  return QualityNonConformance;
};
