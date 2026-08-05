'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class CustomerLedger extends Model {
    static associate(models) {
      CustomerLedger.belongsTo(models.CustomerAccount, { foreignKey: 'customerId', as: 'customer' });
      CustomerLedger.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    }
  }

  CustomerLedger.init({
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    transactionDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    transactionType: {
      type: DataTypes.ENUM('Opening_Balance', 'Sale_Invoice', 'Payment', 'Credit_Note', 'Debit_Note'),
      allowNull: false
    },
    documentNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false
    },
    debitAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00 // Borç (Müşterinin ödemesi gereken tutar - Fatura vb.)
    },
    creditAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00 // Alacak (Müşterinin yaptığı ödeme / İade vb.)
    },
    balance: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00 // Anlık Güncel Bakiye
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'CustomerLedger',
    tableName: 'CustomerLedgers'
  });

  return CustomerLedger;
};
