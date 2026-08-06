'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QualityEquipment extends Model {
    static associate(models) {
      // associations if any
    }
  }

  QualityEquipment.init({
    equipmentCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('Dimension', 'Weight', 'Temperature', 'Electrical', 'Pressure'),
      allowNull: false,
      defaultValue: 'Dimension'
    },
    brandModel: {
      type: DataTypes.STRING,
      allowNull: true
    },
    serialNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    calibrationPeriodMonths: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 12
    },
    lastCalibrationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    nextCalibrationDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('Valid', 'Due_Soon', 'Expired', 'In_Maintenance'),
      allowNull: false,
      defaultValue: 'Valid'
    },
    calibrationLab: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'QualityEquipment',
    tableName: 'QualityEquipments'
  });

  return QualityEquipment;
};
