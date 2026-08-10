'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CustomerAccount extends Model {
    static associate(models) {
      CustomerAccount.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      CustomerAccount.hasMany(models.SaleOrder, { foreignKey: 'customerId', as: 'orders' });
      CustomerAccount.hasMany(models.SaleQuotation, { foreignKey: 'customerId', as: 'quotations' });
      CustomerAccount.hasMany(models.CustomerPriceList, { foreignKey: 'customerId', as: 'priceLists' });
      CustomerAccount.hasMany(models.CustomerLedger, { foreignKey: 'customerId', as: 'ledgerEntries' });
    }
  }

  CustomerAccount.init({
    customerCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    taxOffice: {
      type: DataTypes.STRING,
      allowNull: true
    },
    taxNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    contactPerson: {
      type: DataTypes.STRING,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING,
      defaultValue: 'Türkiye'
    },
    creditLimit: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 100000.00
    },
    currentBalance: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    paymentTermDays: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    riskLevel: {
      type: DataTypes.STRING,
      defaultValue: 'Low'
    },
    customerScore: {
      type: DataTypes.INTEGER,
      defaultValue: 85,
      allowNull: false
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Active'
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
    modelName: 'CustomerAccount',
    tableName: 'CustomerAccounts'
  });

  return CustomerAccount;
};
