'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QualityCapa extends Model {
    static associate(models) {
      QualityCapa.belongsTo(models.QualityNonConformance, { foreignKey: 'ncrId', as: 'ncr' });
    }
  }

  QualityCapa.init({
    capaNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    ncrId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rootCauseMethod: {
      type: DataTypes.ENUM('5_Why', 'Ishikawa', 'Pareto', '8D'),
      allowNull: false,
      defaultValue: '5_Why'
    },
    rootCauseDescription: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    correctiveAction: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    preventiveAction: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    targetDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('Draft', 'In_Progress', 'Verification_Pending', 'Completed'),
      allowNull: false,
      defaultValue: 'In_Progress'
    },
    assignedTo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    verifiedBy: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'QualityCapa',
    tableName: 'QualityCapas'
  });

  return QualityCapa;
};
