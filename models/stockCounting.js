'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class StokSayimi extends Model {
    static associate(models) {
      StokSayimi.belongsTo(models.Depo, { foreignKey: 'depoId', as: 'depo' });
      StokSayimi.belongsTo(models.Kullanici, { foreignKey: 'yapanKullaniciId', as: 'kullanici' });
    }
  }

  StokSayimi.init({
    sayimNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    depoId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sayimTarihi: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    durum: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Completed'
    },
    notlar: {
      type: DataTypes.STRING,
      allowNull: true
    },
    yapanKullaniciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'StokSayimi',
    tableName: 'StokSayimlari'
  });

  return StokSayimi;
};
