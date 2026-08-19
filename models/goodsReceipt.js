'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MalKabul extends Model {
    static associate(models) {
      MalKabul.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      MalKabul.belongsTo(models.SatinAlmaSiparisi, { foreignKey: 'satinAlmaSiparisId', as: 'satinAlmaSiparisi' });
      MalKabul.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      MalKabul.belongsTo(models.Tedarikci, { foreignKey: 'tedarikciId', as: 'tedarikci' });
    }
  }

  MalKabul.init({
    malKabulNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    satinAlmaSiparisId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    tedarikciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    siparisMiktari: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    teslimMiktari: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: true,
      defaultValue: 0
    },
    kabulMiktari: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    redMiktari: {
      type: DataTypes.DECIMAL(15, 4),
      allowNull: false,
      defaultValue: 0
    },
    kabulTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    irsaliyeNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    irsaliyeTarihi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    irsaliyeFotograf: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kalemlerVerisi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    kaliteDurumu: {
      type: DataTypes.ENUM('Pending_Inspection', 'Approved', 'Partial_Approved', 'Rejected'),
      allowNull: false,
      defaultValue: 'Pending_Inspection'
    },
    denetciAdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    kaliteNotlari: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    depoLokasyonu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('Pending', 'Completed', 'Partial', 'Returned'),
      allowNull: false,
      defaultValue: 'Pending'
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
    modelName: 'MalKabul',
    tableName: 'MalKabulleri'
  });

  return MalKabul;
};
