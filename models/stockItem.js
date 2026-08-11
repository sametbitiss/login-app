'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StockItem extends Model {
    static associate(models) {
      StockItem.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    }
  }

  StockItem.init({
    stockCode: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    barcode: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    category: {
      type: DataTypes.ENUM('Hammadde', 'Yari_Mamul', 'Yarı_Mamul', 'Mamul', 'Yedek_Parca', 'Ambalaj', 'Ticari_Mal', 'Hizmet', 'Diger'),
      allowNull: false,
      defaultValue: 'Ticari_Mal'
    },
    unit: {
      type: DataTypes.ENUM('Adet', 'Kg', 'Lt', 'Mt', 'M2', 'M3', 'Paket', 'Koli', 'Ton', 'Set'),
      allowNull: false,
      defaultValue: 'Adet'
    },
    brand: {
      type: DataTypes.STRING,
      allowNull: true
    },
    model: {
      type: DataTypes.STRING,
      allowNull: true
    },
    currentStock: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    reservedStock: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    minStock: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    maxStock: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    salePrice: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.ENUM('TRY', 'USD', 'EUR'),
      allowNull: false,
      defaultValue: 'TRY'
    },
    taxRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 20.00
    },
    warehouseLocation: {
      type: DataTypes.STRING,
      allowNull: true
    },
    supplier: {
      type: DataTypes.STRING,
      allowNull: true
    },
    shelfLife: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    weight: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: true
    },
    dimensions: {
      type: DataTypes.STRING,
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('Active', 'Passive', 'Discontinued'),
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
    modelName: 'StockItem',
    tableName: 'StockItems'
  });

  return StockItem;
};
