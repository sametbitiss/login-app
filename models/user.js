'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.AuditLog, { foreignKey: 'userId', as: 'auditLogs' });
      User.hasMany(models.StockItem, { foreignKey: 'createdBy', as: 'createdStockItems' });
      User.hasMany(models.SaleOrder, { foreignKey: 'createdBy', as: 'createdSaleOrders' });
      User.hasMany(models.PurchaseOrder, { foreignKey: 'createdBy', as: 'createdPurchaseOrders' });
    }
  }

  User.init({
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    firstName: DataTypes.STRING,
    lastName: DataTypes.STRING,
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    department: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Genel'
    },
    title: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Personel'
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Employee'
    },
    status: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Suspended'),
      allowNull: false,
      defaultValue: 'Active'
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'Users'
  });

  return User;
};