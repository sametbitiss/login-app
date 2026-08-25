'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class UretimEmriOperasyon extends Model {
    static associate(models) {
      UretimEmriOperasyon.belongsTo(models.UretimEmri, { foreignKey: 'uretimEmriId', as: 'uretimEmri', onDelete: 'CASCADE' });
      UretimEmriOperasyon.belongsTo(models.StokKarti, { foreignKey: 'stokId', as: 'stokKarti' });
      UretimEmriOperasyon.belongsTo(models.RotaOperasyon, { foreignKey: 'rotaOperasyonId', as: 'rotaOperasyon' });
      UretimEmriOperasyon.belongsTo(models.IsMerkezi, { foreignKey: 'isMerkeziId', as: 'isMerkeziKarti' });
      UretimEmriOperasyon.belongsTo(models.UretimEmriOperasyon, { foreignKey: 'oncekiOperasyonId', as: 'oncekiOperasyon' });
      UretimEmriOperasyon.belongsTo(models.UretimEmriOperasyon, { foreignKey: 'sonrakiOperasyonId', as: 'sonrakiOperasyon' });
      UretimEmriOperasyon.belongsTo(models.Kullanici, { foreignKey: 'operatorId', as: 'operator' });
    }
  }

  UretimEmriOperasyon.init({
    uretimEmriId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'UretimEmirleri',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    isEmriNo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    stokId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    rotaOperasyonId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    operasyonSira: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10
    },
    operasyonKodu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    operasyonAdi: {
      type: DataTypes.STRING,
      allowNull: false
    },
    isMerkeziId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    isMerkezi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    planlananMiktar: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 1
    },
    tamamlananMiktar: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    fireMiktari: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false,
      defaultValue: 0
    },
    birim: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Adet'
    },
    hazirlikSuresiDakika: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 15.0
    },
    calismaSuresiDakikaBirim: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 5.0
    },
    toplamTahminiDakika: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      defaultValue: 60.0
    },
    durum: {
      type: DataTypes.ENUM('Ready', 'Waiting_Previous_Op', 'In_Production', 'Paused', 'Completed', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Ready'
    },
    oncekiOperasyonId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    sonrakiOperasyonId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    gerceklesenBaslangicTarihi: {
      type: DataTypes.DATE,
      allowNull: true
    },
    gerceklesenBitisTarihi: {
      type: DataTypes.DATE,
      allowNull: true
    },
    operatorId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    operatorAdi: {
      type: DataTypes.STRING,
      allowNull: true
    },
    notlar: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'UretimEmriOperasyon',
    tableName: 'UretimEmriOperasyonlari'
  });

  return UretimEmriOperasyon;
};
