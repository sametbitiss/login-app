'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class KaliteMuayene extends Model {
    static associate(models) {
      KaliteMuayene.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      KaliteMuayene.belongsTo(models.Tedarikci, { foreignKey: 'tedarikciId', as: 'tedarikci' });
      KaliteMuayene.belongsTo(models.UretimEmri, { foreignKey: 'uretimEmriId', as: 'uretimEmri' });
    }
  }

  KaliteMuayene.init({
    muayeneNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    tur: {
      type: DataTypes.ENUM('Incoming', 'InProcess', 'Final'),
      allowNull: false,
      defaultValue: 'Incoming'
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    partiNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    tedarikciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    uretimEmriId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    numuneMiktari: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    kabulMiktari: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    redMiktari: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    karar: {
      type: DataTypes.ENUM('Accepted', 'Conditional_Accept', 'Rejected'),
      allowNull: false,
      defaultValue: 'Accepted'
    },
    denetciAdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    hataKategorisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    muayeneTarihi: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'KaliteMuayene',
    tableName: 'KaliteMuayeneleri'
  });

  return KaliteMuayene;
};
