'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class PurchaseInvoice extends Model {
    static associate(models) {
      PurchaseInvoice.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      PurchaseInvoice.belongsTo(models.PurchaseOrder, { foreignKey: 'purchaseOrderId', as: 'purchaseOrder' });
      PurchaseInvoice.belongsTo(models.Supplier, { foreignKey: 'supplierId', as: 'supplier' });
    }
  }

  PurchaseInvoice.init({
    invoiceNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    purchaseOrderId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    supplierId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    supplierName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    supplierTaxOffice: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierTaxNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    billingAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    supplierPhone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplierEmail: {
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
    invoiceType: {
      type: DataTypes.STRING,
      defaultValue: 'SATIN_ALMA'
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
    bankName: {
      type: DataTypes.STRING,
      defaultValue: 'T.C. Ziraat Bankası A.Ş.'
    },
    ibanNo: {
      type: DataTypes.STRING,
      defaultValue: 'TR62 0001 0000 0000 0000 1234 56'
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
    paymentTerm: {
      type: DataTypes.STRING,
      defaultValue: 'Vadeli_30'
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
    modelName: 'PurchaseInvoice',
    tableName: 'PurchaseInvoices'
  });

  return PurchaseInvoice;
};
