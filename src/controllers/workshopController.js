const asyncHandler = require('../utils/asyncHandler');
const workshopRepository = require('../repositories/workshopRepository');
const { ValidationError, NotFoundError } = require('../utils/appError');
const { Kullanici } = require('../../models');

class WorkshopController {
  listWorkshops = asyncHandler(async (req, res) => {
    const { search, status } = req.query;

    const workshops = await workshopRepository.findAll({ search, status });
    const stats = await workshopRepository.getStats();

    res.render('production/workshops', {
      user: req.user,
      workshops,
      stats,
      activeSubTab: 'workshops',
      filterSearch: search || '',
      filterStatus: status || ''
    });
  });

  renderAddWorkshop = asyncHandler(async (req, res) => {
    const nextCode = await workshopRepository.generateWorkshopCode();
    const eligibleManagers = await workshopRepository.getEligiblePersonnel();

    res.render('production/workshop_form', {
      user: req.user,
      workshop: null,
      isEditMode: false,
      nextCode,
      eligibleManagers,
      activeSubTab: 'workshops',
      error: null
    });
  });

  renderEditWorkshop = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const workshop = await workshopRepository.findById(id);
    if (!workshop) {
      throw new NotFoundError('Atölye kaydı bulunamadı.');
    }

    const eligibleManagers = await workshopRepository.getEligiblePersonnel();

    res.render('production/workshop_form', {
      user: req.user,
      workshop,
      isEditMode: true,
      nextCode: workshop.atolyeKodu,
      eligibleManagers,
      activeSubTab: 'workshops',
      error: null
    });
  });

  saveWorkshop = asyncHandler(async (req, res) => {
    const { id, atolyeKodu, atolyeAdi, sorumluId, durum, aciklama } = req.body;

    // Strict Validation for fields 1-4
    if (!atolyeAdi || !atolyeAdi.trim()) {
      throw new ValidationError('Atölye adı zorunludur.');
    }

    if (!sorumluId) {
      throw new ValidationError('Lütfen atölye sorumlusunu modal penceresinden seçiniz.');
    }

    if (!durum || !['Active', 'Inactive'].includes(durum)) {
      throw new ValidationError('Lütfen geçerli bir atölye durumu seçiniz (Aktif/Pasif).');
    }

    // Verify assigned manager exists and has general personnel role
    const assignedUser = await Kullanici.findByPk(sorumluId);
    if (!assignedUser) {
      throw new ValidationError('Seçilen atölye sorumlusu sistemde bulunamadı.');
    }

    const isPersonnel = ['Employee', 'Genel_Personel', 'Genel Personel'].includes(assignedUser.rol);
    if (!isPersonnel) {
      throw new ValidationError('Atölye sorumlusu sadece Genel Personel (Employee) rolündeki çalışanlardan seçilebilir.');
    }

    if (id) {
      await workshopRepository.update(
        id,
        {
          atolyeAdi: atolyeAdi.trim(),
          sorumluId: parseInt(sorumluId, 10),
          durum,
          aciklama: aciklama ? aciklama.trim() : null
        },
        req.user,
        req.ip
      );
    } else {
      const code = atolyeKodu || (await workshopRepository.generateWorkshopCode());
      await workshopRepository.create(
        {
          atolyeKodu: code,
          atolyeAdi: atolyeAdi.trim(),
          sorumluId: parseInt(sorumluId, 10),
          durum,
          aciklama: aciklama ? aciklama.trim() : null
        },
        req.user,
        req.ip
      );
    }

    res.redirect('/production/workshops');
  });

  deleteWorkshop = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deleted = await workshopRepository.delete(id, req.user, req.ip);
    if (!deleted) {
      throw new NotFoundError('Silinecek atölye bulunamadı.');
    }

    res.redirect('/production/workshops');
  });
}

module.exports = new WorkshopController();
