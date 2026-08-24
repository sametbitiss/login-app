'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UretimEmri extends Model {
    static associate(models) {
      UretimEmri.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      UretimEmri.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
    }
  }

  UretimEmri.init({
    isEmriNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    uretimBasligi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    planlananMiktar: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 1
    },
    tamamlananMiktar: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    fireMiktari: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0
    },
    birim: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    durum: {
      type: DataTypes.ENUM('Planned', 'Approved', 'In_Production', 'Quality_Check', 'Completed', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Planned'
    },
    oncelik: {
      type: DataTypes.ENUM('Low', 'Normal', 'High', 'Urgent'),
      allowNull: false,
      defaultValue: 'Normal'
    },
    isMerkezi: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null
    },
    planlananBaslangicTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    planlananBitisTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    gerceklesenBaslangicTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    gerceklesenBitisTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    tahminiSaat: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: 0
    },
    gerceklesenSaat: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      defaultValue: 0
    },
    receteNotlari: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    uretimYonetici: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'UretimEmri',
    tableName: 'UretimEmirleri'
  });

  return UretimEmri;
};
