'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class KaliteUygunsuzluk extends Model {
    static associate(models) {
      KaliteUygunsuzluk.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      KaliteUygunsuzluk.hasMany(models.KaliteDof, { foreignKey: 'uygunsuzlukId', as: 'doflar' });
    }
  }

  KaliteUygunsuzluk.init({
    uygunsuzlukNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    baslik: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tur: {
      type: DataTypes.ENUM('Material', 'Process', 'Customer_Return', 'Supplier_Defect'),
      allowNull: false,
      defaultValue: 'Material'
    },
    ciddiyet: {
      type: DataTypes.ENUM('Critical', 'Major', 'Minor'),
      allowNull: false,
      defaultValue: 'Major'
    },
    durum: {
      type: DataTypes.ENUM('Open', 'Under_Investigation', 'Action_Required', 'Closed'),
      allowNull: false,
      defaultValue: 'Open'
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    partiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    etkilenenMiktar: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    tespitEden: {
      type: DataTypes.STRING,
      allowNull: true
    },
    atananKisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    aciklama: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kararVeIslem: {
      type: DataTypes.ENUM('Scrap', 'Rework', 'ReturnToSupplier', 'UseAsIs'),
      allowNull: false,
      defaultValue: 'Rework'
    }
  }, {
    sequelize,
    modelName: 'KaliteUygunsuzluk',
    tableName: 'KaliteUygunsuzluklari'
  });

  return KaliteUygunsuzluk;
};
