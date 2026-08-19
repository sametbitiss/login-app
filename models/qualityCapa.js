'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class KaliteDof extends Model {
    static associate(models) {
      KaliteDof.belongsTo(models.KaliteUygunsuzluk, { foreignKey: 'uygunsuzlukId', as: 'uygunsuzluk' });
    }
  }

  KaliteDof.init({
    dofNo: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    uygunsuzlukId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    baslik: {
      type: DataTypes.STRING,
      allowNull: false
    },
    kokNedenYontemi: {
      type: DataTypes.ENUM('5_Why', 'Ishikawa', 'Pareto', '8D'),
      allowNull: false,
      defaultValue: '5_Why'
    },
    kokNedenAciklamasi: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duzelticiFaaliyet: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    onleyiciFaaliyet: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    hedefTarih: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    durum: {
      type: DataTypes.ENUM('Draft', 'In_Progress', 'Verification_Pending', 'Completed'),
      allowNull: false,
      defaultValue: 'In_Progress'
    },
    atananKisi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    onaylayanKisi: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'KaliteDof',
    tableName: 'KaliteDoflari'
  });

  return KaliteDof;
};
