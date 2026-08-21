const asyncHandler = require('../utils/asyncHandler');
const workCenterRepository = require('../repositories/workCenterRepository');
const { ValidationError, NotFoundError } = require('../utils/appError');
const { Atolye, IsMerkezi } = require('../../models');
const { Op } = require('sequelize');

class WorkCenterController {
  listWorkCenters = asyncHandler(async (req, res) => {
    const { search, status, atolyeId } = req.query;

    const workCenters = await workCenterRepository.findAll({ search, status, atolyeId });
    const stats = await workCenterRepository.getStats();
    const workshops = await Atolye.findAll({ order: [['atolyeAdi', 'ASC']] });

    res.render('production/work_centers', {
      user: req.user,
      workCenters,
      stats,
      workshops,
      activeSubTab: 'workCenters',
      filterSearch: search || '',
      filterStatus: status || '',
      filterAtolyeId: atolyeId || ''
    });
  });

  renderAddWorkCenter = asyncHandler(async (req, res) => {
    const workshops = await Atolye.findAll({
      where: { durum: 'Active' },
      order: [['atolyeAdi', 'ASC']]
    });

    res.render('production/work_center_form', {
      user: req.user,
      workCenter: null,
      isEditMode: false,
      workshops,
      activeSubTab: 'workCenters',
      error: null
    });
  });

  renderEditWorkCenter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const workCenter = await workCenterRepository.findById(id);
    if (!workCenter) {
      throw new NotFoundError('İş merkezi kaydı bulunamadı.');
    }

    const workshops = await Atolye.findAll({ order: [['atolyeAdi', 'ASC']] });

    res.render('production/work_center_form', {
      user: req.user,
      workCenter,
      isEditMode: true,
      workshops,
      activeSubTab: 'workCenters',
      error: null
    });
  });

  saveWorkCenter = asyncHandler(async (req, res) => {
    const { id, isMerkeziKodu, isMerkeziAdi, atolyeId, gunlukCalismaSaati, durum, varsayilanIsciSayisi } = req.body;

    // 1. Validate isMerkeziKodu (Zorunlu)
    if (!isMerkeziKodu || !isMerkeziKodu.trim()) {
      throw new ValidationError('Lütfen iş merkezi kodunu giriniz.');
    }

    // 2. Validate isMerkeziAdi (Zorunlu)
    if (!isMerkeziAdi || !isMerkeziAdi.trim()) {
      throw new ValidationError('Lütfen iş merkezi adını giriniz.');
    }

    // 3. Validate atolyeId (Zorunlu)
    if (!atolyeId) {
      throw new ValidationError('Lütfen bağlı olduğu atölyeyi seçiniz.');
    }

    // 4. Validate gunlukCalismaSaati (Zorunlu)
    const hours = parseFloat(gunlukCalismaSaati);
    if (isNaN(hours) || hours <= 0 || hours > 24) {
      throw new ValidationError('Günlük çalışma saati (kapasite) 0 ile 24 saat arasında geçerli bir sayı olmalıdır.');
    }

    // 5. Validate durum (Zorunlu)
    if (!durum || !['Active', 'Inactive'].includes(durum)) {
      throw new ValidationError('Lütfen geçerli bir durum seçiniz (Aktif/Pasif).');
    }

    // 6. Optional varsayilanIsciSayisi validation
    let isciSayisi = null;
    if (varsayilanIsciSayisi !== undefined && varsayilanIsciSayisi !== '') {
      const parsedIsci = parseInt(varsayilanIsciSayisi, 10);
      if (!isNaN(parsedIsci) && parsedIsci >= 0) {
        isciSayisi = parsedIsci;
      }
    }

    // Check unique code
    const existingCode = await IsMerkezi.findOne({
      where: {
        isMerkeziKodu: isMerkeziKodu.trim(),
        ...(id ? { id: { [Op.ne]: id } } : {})
      }
    });
    if (existingCode) {
      throw new ValidationError(`"${isMerkeziKodu.trim()}" iş merkezi kodu zaten başka bir iş merkezi tarafından kullanılmaktadır.`);
    }

    // Verify Workshop exists
    const targetWorkshop = await Atolye.findByPk(atolyeId);
    if (!targetWorkshop) {
      throw new ValidationError('Seçilen atölye sistemde bulunamadı.');
    }

    if (id) {
      await workCenterRepository.update(
        id,
        {
          isMerkeziKodu: isMerkeziKodu.trim(),
          isMerkeziAdi: isMerkeziAdi.trim(),
          atolyeId: parseInt(atolyeId, 10),
          gunlukCalismaSaati: hours,
          durum,
          varsayilanIsciSayisi: isciSayisi
        },
        req.user,
        req.ip
      );
    } else {
      await workCenterRepository.create(
        {
          isMerkeziKodu: isMerkeziKodu.trim(),
          isMerkeziAdi: isMerkeziAdi.trim(),
          atolyeId: parseInt(atolyeId, 10),
          gunlukCalismaSaati: hours,
          durum,
          varsayilanIsciSayisi: isciSayisi
        },
        req.user,
        req.ip
      );
    }

    res.redirect('/production/work-centers');
  });

  deleteWorkCenter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const deleted = await workCenterRepository.delete(id, req.user, req.ip);
    if (!deleted) {
      throw new NotFoundError('Silinecek iş merkezi bulunamadı.');
    }

    res.redirect('/production/work-centers');
  });
}

module.exports = new WorkCenterController();
