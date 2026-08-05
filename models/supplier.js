'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Supplier extends Model {
    static associate(models) {
      Supplier.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      Supplier.hasMany(models.PurchaseOrder, { foreignKey: 'supplierId', as: 'purchaseOrders' });
      Supplier.hasMany(models.PurchaseRfq, { foreignKey: 'supplierId', as: 'rfqs' });
      Supplier.hasMany(models.GoodsReceipt, { foreignKey: 'supplierId', as: 'goodsReceipts' });
    }
  }

  Supplier.init({
    supplierCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    companyName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    taxNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    taxOffice: {
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
    fax: {
      type: DataTypes.STRING,
      allowNull: true
    },
    website: {
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
      allowNull: true,
      defaultValue: 'Türkiye'
    },
    paymentTerm: {
      type: DataTypes.ENUM('Pesin', 'Vadeli_30', 'Vadeli_60', 'Vadeli_90', 'Kredi_Karti'),
      allowNull: false,
      defaultValue: 'Vadeli_30'
    },
    currency: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    riskLimit: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 100000
    },
    currentBalance: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    category: {
      type: DataTypes.ENUM('Hammadde', 'Yari_Mamul', 'Hizmet', 'Yedek_Parca', 'Ambalaj', 'Diger'),
      allowNull: false,
      defaultValue: 'Hammadde'
    },
    performanceScore: {
      type: DataTypes.DECIMAL(3, 1),
      allowNull: false,
      defaultValue: 0
    },
    onTimeDeliveryRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    qualityScore: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0
    },
    totalOrderCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    totalSpend: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0
    },
    status: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Blacklisted'),
      allowNull: false,
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
    modelName: 'Supplier',
    tableName: 'Suppliers'
  });

  return Supplier;
};
