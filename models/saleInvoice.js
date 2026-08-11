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
    customerTaxOffice: {
      type: DataTypes.STRING,
      allowNull: true
    },
    billingAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    customerPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    customerEmail: {
      type: DataTypes.STRING,
      allowNull: true
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    invoiceTime: {
      type: DataTypes.STRING,
      defaultValue: '10:30:00'
    },
    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    invoiceType: {
      type: DataTypes.STRING,
      defaultValue: 'SATIS'
    },
    invoiceScenario: {
      type: DataTypes.STRING,
      defaultValue: 'EARSIVFATURA'
    },
    ettnNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    orderNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    orderDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    dispatchNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dispatchDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
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
    exchangeRate: {
      type: DataTypes.DECIMAL(10, 4),
      defaultValue: 1.0000
    },
    paymentType: {
      type: DataTypes.STRING,
      defaultValue: 'Vadeli'
    },
    paymentTermDays: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    bankName: {
      type: DataTypes.STRING,
      defaultValue: 'Ziraat Bankası A.Ş. - Maslak Şubesi'
    },
    ibanNo: {
      type: DataTypes.STRING,
      defaultValue: 'TR56 0001 0002 0003 0004 0005 06'
    },
    paymentStatus: {
      type: DataTypes.STRING,
      defaultValue: 'Unpaid'
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Issued'
    },
    itemsJson: {
      type: DataTypes.TEXT,
      allowNull: true
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
