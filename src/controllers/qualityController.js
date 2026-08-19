const qualityRepository = require('../repositories/qualityRepository');
const stockRepository = require('../repositories/stockRepository');
const { Tedarikci, UretimEmri } = require('../../models');
const asyncHandler = require('../utils/asyncHandler');

class QualityController {
  // 0. Dashboard & Analytics
  showAnalytics = asyncHandler(async (req, res) => {
    const metrics = await qualityRepository.getAnalytics();
    const recentInspections = await qualityRepository.getInspections();
    const recentNcrs = await qualityRepository.getNcrs();
    const recentCapas = await qualityRepository.getCapas();
    const equipments = await qualityRepository.getEquipments();

    res.render('quality/dashboard', {
      user: req.user,
      metrics,
      recentInspections: recentInspections.slice(0, 5),
      recentNcrs: recentNcrs.slice(0, 5),
      recentCapas: recentCapas.slice(0, 5),
      equipments: equipments.slice(0, 5)
    });
  });

  // 1. Muayene Kayıtları (IQC / IPQC / FQC)
  listInspections = asyncHandler(async (req, res) => {
    const type = req.query.type || req.query.tur || null;
    const inspections = await qualityRepository.getInspections(type);
    res.render('quality/inspections', { user: req.user, inspections, currentType: type });
  });

  renderAddInspection = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();
    const suppliers = await Tedarikci.findAll();
    const productionOrders = await UretimEmri.findAll();
    res.render('quality/inspection_add', { user: req.user, stockItems, suppliers, productionOrders });
  });

  addInspection = asyncHandler(async (req, res) => {
    const { type, tur, stockItemId, stokId, lotNumber, partiNo, supplierId, tedarikciId, productionOrderId, uretimEmriId, sampleSize, numuneMiktari, passedQuantity, kabulMiktari, rejectedQuantity, redMiktari, decision, karar, inspectorName, denetciAdi, defectCategory, hataKategorisi, notes, notlar } = req.body;
    await qualityRepository.createInspection({
      tur: tur || type,
      stokId: parseInt(stokId || stockItemId),
      partiNo: partiNo || lotNumber,
      tedarikciId: (tedarikciId || supplierId) ? parseInt(tedarikciId || supplierId) : null,
      uretimEmriId: (uretimEmriId || productionOrderId) ? parseInt(uretimEmriId || productionOrderId) : null,
      numuneMiktari: parseInt(numuneMiktari || sampleSize) || 1,
      kabulMiktari: parseInt(kabulMiktari || passedQuantity) || 0,
      redMiktari: parseInt(redMiktari || rejectedQuantity) || 0,
      karar: karar || decision,
      denetciAdi: denetciAdi || inspectorName,
      hataKategorisi: hataKategorisi || defectCategory,
      notlar: notlar || notes
    });
    res.redirect('/quality/inspections');
  });

  // 2. Uygunsuzluk Yönetimi (NCR)
  listNcrs = asyncHandler(async (req, res) => {
    const ncrs = await qualityRepository.getNcrs();
    res.render('quality/ncr', { user: req.user, ncrs });
  });

  renderAddNcr = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();
    res.render('quality/ncr_add', { user: req.user, stockItems });
  });

  addNcr = asyncHandler(async (req, res) => {
    const { title, baslik, type, tur, severity, ciddiyet, status, durum, stockItemId, stokId, lotNumber, partiNo, quantityAffected, etkilenenMiktar, detectedBy, tespitEden, assignedTo, atananKisi, description, aciklama, disposition, kararVeIslem } = req.body;
    await qualityRepository.createNcr({
      baslik: baslik || title,
      tur: tur || type,
      ciddiyet: ciddiyet || severity,
      durum: durum || status,
      stokId: (stokId || stockItemId) ? parseInt(stokId || stockItemId) : null,
      partiNo: partiNo || lotNumber,
      etkilenenMiktar: parseInt(etkilenenMiktar || quantityAffected) || 1,
      tespitEden: tespitEden || detectedBy,
      atananKisi: atananKisi || assignedTo,
      aciklama: aciklama || description,
      kararVeIslem: kararVeIslem || disposition
    });
    res.redirect('/quality/ncr');
  });

  // 3. CAPA (Düzeltici & Önleyici Faaliyetler)
  listCapas = asyncHandler(async (req, res) => {
    const capas = await qualityRepository.getCapas();
    res.render('quality/capa', { user: req.user, capas });
  });

  addCapa = asyncHandler(async (req, res) => {
    const { ncrId, uygunsuzlukId, title, baslik, rootCauseMethod, kokNedenYontemi, rootCauseDescription, kokNedenAciklamasi, correctiveAction, duzelticiFaaliyet, preventiveAction, onleyiciFaaliyet, targetDate, hedefTarih, status, durum, assignedTo, atananKisi, verifiedBy, onaylayanKisi } = req.body;
    await qualityRepository.createCapa({
      uygunsuzlukId: (uygunsuzlukId || ncrId) ? parseInt(uygunsuzlukId || ncrId) : null,
      baslik: baslik || title,
      kokNedenYontemi: kokNedenYontemi || rootCauseMethod,
      kokNedenAciklamasi: kokNedenAciklamasi || rootCauseDescription,
      duzelticiFaaliyet: duzelticiFaaliyet || correctiveAction,
      onleyiciFaaliyet: onleyiciFaaliyet || preventiveAction,
      hedefTarih: hedefTarih || targetDate || null,
      durum: durum || status,
      atananKisi: atananKisi || assignedTo,
      onaylayanKisi: onaylayanKisi || verifiedBy
    });
    res.redirect('/quality/capa');
  });

  // 4. Lot/Seri İzlenebilirlik (Traceability Tree)
  showTraceability = asyncHandler(async (req, res) => {
    const lotNumber = req.query.lotNumber || req.query.partiNo || 'LOT-2026-A101';
    const traceData = await qualityRepository.getLotTraceability(lotNumber);
    res.render('quality/traceability', { user: req.user, traceData, searchLot: lotNumber });
  });

  // 5. Kalibrasyon & Ölçüm Cihazları
  listEquipments = asyncHandler(async (req, res) => {
    const equipments = await qualityRepository.getEquipments();
    res.render('quality/equipment', { user: req.user, equipments });
  });

  addEquipment = asyncHandler(async (req, res) => {
    const { name, ad, category, kategori, brandModel, markaModel, serialNo, seriNo, calibrationPeriodMonths, kalibrasyonPeriyoduAy, lastCalibrationDate, sonKalibrasyonTarihi, nextCalibrationDate, gelecekKalibrasyonTarihi, status, durum, calibrationLab, kalibrasyonLaboratuvari, notes, notlar } = req.body;
    await qualityRepository.createEquipment({
      ad: ad || name,
      kategori: kategori || category,
      markaModel: markaModel || brandModel,
      seriNo: seriNo || serialNo,
      kalibrasyonPeriyoduAy: parseInt(kalibrasyonPeriyoduAy || calibrationPeriodMonths) || 12,
      sonKalibrasyonTarihi: sonKalibrasyonTarihi || lastCalibrationDate || null,
      gelecekKalibrasyonTarihi: gelecekKalibrasyonTarihi || nextCalibrationDate || null,
      durum: durum || status,
      kalibrasyonLaboratuvari: kalibrasyonLaboratuvari || calibrationLab,
      notlar: notlar || notes
    });
    res.redirect('/quality/equipment');
  });

  // 6. ISO Belgeleri & Dokümanlar
  listDocuments = asyncHandler(async (req, res) => {
    const documents = await qualityRepository.getDocuments();
    res.render('quality/documents', { user: req.user, documents });
  });

  addDocument = asyncHandler(async (req, res) => {
    const { docCode, dokumanKodu, title, baslik, category, kategori, revisionNo, revizyonNo, effectiveDate, gecerlilikTarihi, owner, sorumlu, status, durum, fileUrl, dosyaYolu, description, aciklama } = req.body;
    await qualityRepository.createDocument({
      dokumanKodu: dokumanKodu || docCode,
      baslik: baslik || title,
      kategori: kategori || category,
      revizyonNo: revizyonNo || revisionNo,
      gecerlilikTarihi: gecerlilikTarihi || effectiveDate || null,
      sorumlu: sorumlu || owner,
      durum: durum || status,
      dosyaYolu: dosyaYolu || fileUrl,
      aciklama: aciklama || description
    });
    res.redirect('/quality/documents');
  });
}

module.exports = new QualityController();
