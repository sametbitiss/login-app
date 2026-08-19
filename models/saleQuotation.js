'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SatisTeklifi extends Model {
    static associate(models) {
      SatisTeklifi.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
      SatisTeklifi.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      SatisTeklifi.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
    }
  }

  SatisTeklifi.init({
    teklifNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    musteriId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    musteriAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    teklifTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    gecerlilikBitis: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    kalemlerJson: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    miktar: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.0
    },
    birimFiyat: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    iskontoOrani: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 0.00
    },
    kdvOrani: {
      type: DataTypes.DECIMAL(5, 2),
      defaultValue: 20.00
    },
    araToplam: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    iskontoTutari: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    kdvTutari: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    toplamTutar: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    paraBirimi: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    durum: {
      type: DataTypes.STRING,
      defaultValue: 'Draft'
    },
    onayGerekli: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    onayNedeni: {
      type: DataTypes.STRING,
      allowNull: true
    },
    yoneticiNotlari: {
      type: DataTypes.TEXT,
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
    modelName: 'SatisTeklifi',
    tableName: 'SatisTeklifleri'
  });

  return SatisTeklifi;
};
