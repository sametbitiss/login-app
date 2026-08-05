'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SaleInvoice extends Model {
    static associate(models) {
      SaleInvoice.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      SaleInvoice.belongsTo(models.SaleOrder, { foreignKey: 'saleOrderId', as: 'saleOrder' });
      SaleInvoice.belongsTo(models.SaleDispatchNote, { foreignKey: 'dispatchNoteId', as: 'dispatchNote' });
      SaleInvoice.belongsTo(models.CustomerAccount, { foreignKey: 'customerId', as: 'customer' });
    }
  }

  SaleInvoice.init({
    invoiceNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    saleOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    dispatchNoteId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    customerTaxNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    taxAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    paymentStatus: {
      type: DataTypes.STRING,
      defaultValue: 'Unpaid'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Issued'
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
    modelName: 'SaleInvoice',
    tableName: 'SaleInvoices'
  });

  return SaleInvoice;
};
