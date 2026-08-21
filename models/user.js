'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Kullanici extends Model {
    static associate(models) {
      Kullanici.hasMany(models.DenetimKaydi, { foreignKey: 'kullaniciId', as: 'denetimKayitlari' });
      Kullanici.hasMany(models.StokKarti, { foreignKey: 'olusturanId', as: 'olusturulanStokKartlari' });
      Kullanici.hasMany(models.SatisSiparisi, { foreignKey: 'olusturanId', as: 'olusturulanSatisSiparisleri' });
      Kullanici.hasMany(models.SatinAlmaSiparisi, { foreignKey: 'olusturanId', as: 'olusturulanSatinAlmaSiparisleri' });
      Kullanici.hasMany(models.Atolye, { foreignKey: 'sorumluId', as: 'sorumluOlduguAtolyeler' });
    }
  }

  Kullanici.init({
    kullaniciAdi: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    sifre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    eposta: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    ad: DataTypes.STRING,
    soyad: DataTypes.STRING,
    telefon: {
      type: DataTypes.STRING,
      allowNull: true
    },
    departman: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Genel'
    },
    unvan: {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: 'Personel'
    },
    rol: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Employee'
    },
    durum: {
      type: DataTypes.ENUM('Active', 'Inactive', 'Suspended'),
      allowNull: false,
      defaultValue: 'Active'
    },
    dogrulamaKodu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    dogrulamaKoduSonKullanma: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Kullanici',
    tableName: 'Kullanicilar'
  });

  return Kullanici;
};