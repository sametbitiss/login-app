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
    dispatchType: {
      type: DataTypes.STRING,
      defaultValue: 'Satış İrsaliyesi'
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
    shipmentDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    exitWarehouse: {
      type: DataTypes.STRING,
      defaultValue: 'Merkez Lojistik Deposu'
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
    deliveryCity: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deliveryDistrict: {
      type: DataTypes.STRING,
      allowNull: true
    },
    recipientPerson: {
      type: DataTypes.STRING,
      allowNull: true
    },
    deliveryType: {
      type: DataTypes.STRING,
      allowNull: true
    },
    projectNo: {
      type: DataTypes.STRING,
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
    itemsJson: {
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
