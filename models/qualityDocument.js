'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class QualityDocument extends Model {
    static associate(models) {
      // associations if any
    }
  }

  QualityDocument.init({
    docCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('Procedure', 'Instruction', 'Form', 'Quality_Manual'),
      allowNull: false,
      defaultValue: 'Procedure'
    },
    revisionNo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Rev.01'
    },
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    owner: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('Active', 'Draft', 'Obsolete'),
      allowNull: false,
      defaultValue: 'Active'
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'QualityDocument',
    tableName: 'QualityDocuments'
  });

  return QualityDocument;
};
