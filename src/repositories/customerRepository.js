const { MusteriHesabi, Kullanici, SatisSiparisi } = require('../../models');
const { Op } = require('sequelize');
const logService = require('../services/logService');

class CustomerRepository {
  async findAll({ search, status } = {}) {
    const where = {};
    if (status && status !== '') where.durum = status;
    if (search && search.trim() !== '') {
      const s = `%${search.trim()}%`;
      where[Op.or] = [
        { musteriKodu: { [Op.iLike]: s } },
        { firmaAdi: { [Op.iLike]: s } },
        { ilgiliKisi: { [Op.iLike]: s } },
        { eposta: { [Op.iLike]: s } },
        { telefon: { [Op.iLike]: s } }
      ];
    }

    return await MusteriHesabi.findAll({
      where,
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id) {
    const validId = parseInt(id, 10);
    if (!validId || Number.isNaN(validId) || validId <= 0) return null;
    return await MusteriHesabi.findByPk(validId, {
      include: [
        { model: Kullanici, as: 'olusturan', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad'] },
        { model: SatisSiparisi, as: 'siparisler' }
      ]
    });
  }

  async getNextCustomerCode() {
    const last = await MusteriHesabi.findOne({ order: [['id', 'DESC']] });
    if (!last) return 'CAR-2026-0001';
    const num = last.id + 1;
    return `CAR-2026-${num.toString().padStart(4, '0')}`;
  }

  async create(data, currentUser = null, ipAddress = null) {
    const cleanData = {
      musteriKodu: data.musteriKodu || data.customerCode,
      firmaAdi: data.firmaAdi || data.companyName,
      vergiDairesi: data.vergiDairesi || data.taxOffice,
      vergiNo: data.vergiNo || data.taxNo,
      ilgiliKisi: data.ilgiliKisi || data.contactPerson,
      eposta: data.eposta || data.email,
      telefon: data.telefon || data.phone,
      adres: data.adres || data.address,
      sehir: data.sehir || data.city,
      ulke: data.ulke || data.country || 'Türkiye',
      krediLimiti: data.krediLimiti !== undefined ? data.krediLimiti : data.creditLimit,
      guncelBakiye: data.guncelBakiye !== undefined ? data.guncelBakiye : data.currentBalance,
      vadeGunu: data.vadeGunu !== undefined ? data.vadeGunu : data.paymentTermDays,
      riskSeviyesi: data.riskSeviyesi || data.riskLevel,
      musteriSkoru: data.musteriSkoru !== undefined ? data.musteriSkoru : data.customerScore,
      durum: data.durum || data.status || 'Active',
      notlar: data.notlar || data.notes,
      olusturanId: currentUser ? currentUser.id : null
    };

    const customer = await MusteriHesabi.create(cleanData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'CREATE',
      varlik: 'MusteriHesabi',
      varlikId: customer.id,
      detaylar: { musteriKodu: customer.musteriKodu, firmaAdi: customer.firmaAdi },
      ipAdresi: ipAddress
    });

    return customer;
  }

  async update(id, data, currentUser = null, ipAddress = null) {
    const customer = await MusteriHesabi.findByPk(id);
    if (!customer) return null;

    const updateData = {};
    if (data.musteriKodu !== undefined || data.customerCode !== undefined) updateData.musteriKodu = data.musteriKodu || data.customerCode;
    if (data.firmaAdi !== undefined || data.companyName !== undefined) updateData.firmaAdi = data.firmaAdi || data.companyName;
    if (data.vergiDairesi !== undefined || data.taxOffice !== undefined) updateData.vergiDairesi = data.vergiDairesi || data.taxOffice;
    if (data.vergiNo !== undefined || data.taxNo !== undefined) updateData.vergiNo = data.vergiNo || data.taxNo;
    if (data.ilgiliKisi !== undefined || data.contactPerson !== undefined) updateData.ilgiliKisi = data.ilgiliKisi || data.contactPerson;
    if (data.eposta !== undefined || data.email !== undefined) updateData.eposta = data.eposta || data.email;
    if (data.telefon !== undefined || data.phone !== undefined) updateData.telefon = data.telefon || data.phone;
    if (data.adres !== undefined || data.address !== undefined) updateData.adres = data.adres || data.address;
    if (data.sehir !== undefined || data.city !== undefined) updateData.sehir = data.sehir || data.city;
    if (data.ulke !== undefined || data.country !== undefined) updateData.ulke = data.ulke || data.country;
    if (data.krediLimiti !== undefined || data.creditLimit !== undefined) updateData.krediLimiti = data.krediLimiti !== undefined ? data.krediLimiti : data.creditLimit;
    if (data.guncelBakiye !== undefined || data.currentBalance !== undefined) updateData.guncelBakiye = data.guncelBakiye !== undefined ? data.guncelBakiye : data.currentBalance;
    if (data.vadeGunu !== undefined || data.paymentTermDays !== undefined) updateData.vadeGunu = data.vadeGunu !== undefined ? data.vadeGunu : data.paymentTermDays;
    if (data.riskSeviyesi !== undefined || data.riskLevel !== undefined) updateData.riskSeviyesi = data.riskSeviyesi || data.riskLevel;
    if (data.musteriSkoru !== undefined || data.customerScore !== undefined) updateData.musteriSkoru = data.musteriSkoru !== undefined ? data.musteriSkoru : data.customerScore;
    if (data.durum !== undefined || data.status !== undefined) updateData.durum = data.durum || data.status;
    if (data.notlar !== undefined || data.notes !== undefined) updateData.notlar = data.notlar || data.notes;

    await customer.update(updateData);

    await logService.logCrud({
      kullaniciId: currentUser ? currentUser.id : null,
      kullaniciAdi: currentUser ? currentUser.kullaniciAdi : 'System',
      islem: 'UPDATE',
      varlik: 'MusteriHesabi',
      varlikId: customer.id,
      detaylar: updateData,
      ipAdresi: ipAddress
    });

    return customer;
  }

  async updateBalance(id, amountToAdd) {
    const customer = await MusteriHesabi.findByPk(id);
    if (customer) {
      customer.guncelBakiye = parseFloat(customer.guncelBakiye) + parseFloat(amountToAdd);
      await customer.save();
    }
  }
}

module.exports = new CustomerRepository();
