'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class DenetimKaydi extends Model {
    static associate(models) {
      DenetimKaydi.belongsTo(models.Kullanici, { foreignKey: 'kullaniciId', as: 'kullanici' });
    }
  }

  DenetimKaydi.init({
    kullaniciId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    kullaniciAdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    islem: {
      type: DataTypes.ENUM('CREATE', 'READ', 'UPDATE', 'DELETE'),
      allowNull: false
    },
    varlik: {
      type: DataTypes.STRING,
      allowNull: false
    },
    varlikId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    detaylar: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ipAdresi: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'DenetimKaydi',
    tableName: 'DenetimKayitlari'
  });

  return DenetimKaydi;
};
