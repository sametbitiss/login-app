'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SystemSetting extends Model {}

  SystemSetting.init({
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true
    },
    category: {
      type: DataTypes.STRING,
      defaultValue: 'General'
    }
  }, {
    sequelize,
    modelName: 'SystemSetting',
    tableName: 'SystemSettings'
  });

  return SystemSetting;
};
