'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class MusteriCariHareket extends Model {
    static associate(models) {
      MusteriCariHareket.belongsTo(models.MusteriHesabi, { foreignKey: 'musteriId', as: 'musteri' });
      MusteriCariHareket.belongsTo(models.Kullanici, { foreignKey: 'olusturanId', as: 'olusturan' });
    }
  }

  MusteriCariHareket.init({
    musteriId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    islemTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    islemTuru: {
      type: DataTypes.ENUM('Opening_Balance', 'Sale_Invoice', 'Payment', 'Credit_Note', 'Debit_Note'),
      allowNull: false
    },
    belgeNo: {
      type: DataTypes.STRING,
      allowNull: true
    },
    aciklama: {
      type: DataTypes.STRING,
      allowNull: false
    },
    borcTutari: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    alacakTutari: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    bakiye: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.00
    },
    paraBirimi: {
      type: DataTypes.STRING,
      defaultValue: 'TRY'
    },
    olusturanId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'MusteriCariHareket',
    tableName: 'MusteriCariHareketleri'
  });

  return MusteriCariHareket;
};
