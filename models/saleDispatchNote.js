'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SaleDispatchNote extends Model {
    static associate(models) {
      SaleDispatchNote.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
      SaleDispatchNote.belongsTo(models.SaleOrder, { foreignKey: 'saleOrderId', as: 'saleOrder' });
      SaleDispatchNote.belongsTo(models.CustomerAccount, { foreignKey: 'customerId', as: 'customer' });
    }
  }

  SaleDispatchNote.init({
    dispatchNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    saleOrderId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    dispatchDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    carrierCompany: {
      type: DataTypes.STRING,
      allowNull: true
    },
    vehiclePlate: {
      type: DataTypes.STRING,
      allowNull: true
    },
    driverName: {
      type: DataTypes.STRING,
      allowNull: true
    },
    trackingNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    shippingAddress: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    status: {
      type: DataTypes.STRING,
      defaultValue: 'Dispatched'
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
    modelName: 'SaleDispatchNote',
    tableName: 'SaleDispatchNotes'
  });

  return SaleDispatchNote;
};
