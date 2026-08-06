const qualityRepository = require('../repositories/qualityRepository');
const stockRepository = require('../repositories/stockRepository');
const { Supplier, ProductionOrder } = require('../../models');
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
    const type = req.query.type || null;
    const inspections = await qualityRepository.getInspections(type);
    res.render('quality/inspections', { user: req.user, inspections, currentType: type });
  });

  renderAddInspection = asyncHandler(async (req, res) => {
    const stockItems = await stockRepository.findAll();
    const suppliers = await Supplier.findAll();
    const productionOrders = await ProductionOrder.findAll();
    res.render('quality/inspection_add', { user: req.user, stockItems, suppliers, productionOrders });
  });

  addInspection = asyncHandler(async (req, res) => {
    const { type, stockItemId, lotNumber, supplierId, productionOrderId, sampleSize, passedQuantity, rejectedQuantity, decision, inspectorName, defectCategory, notes } = req.body;
    await qualityRepository.createInspection({
      type,
      stockItemId: parseInt(stockItemId),
      lotNumber,
      supplierId: supplierId ? parseInt(supplierId) : null,
      productionOrderId: productionOrderId ? parseInt(productionOrderId) : null,
      sampleSize: parseInt(sampleSize) || 1,
      passedQuantity: parseInt(passedQuantity) || 0,
      rejectedQuantity: parseInt(rejectedQuantity) || 0,
      decision,
      inspectorName,
      defectCategory,
      notes
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
    const { title, type, severity, status, stockItemId, lotNumber, quantityAffected, detectedBy, assignedTo, description, disposition } = req.body;
    await qualityRepository.createNcr({
      title,
      type,
      severity,
      status,
      stockItemId: stockItemId ? parseInt(stockItemId) : null,
      lotNumber,
      quantityAffected: parseInt(quantityAffected) || 1,
      detectedBy,
      assignedTo,
      description,
      disposition
    });
    res.redirect('/quality/ncr');
  });

  // 3. CAPA (Düzeltici & Önleyici Faaliyetler)
  listCapas = asyncHandler(async (req, res) => {
    const capas = await qualityRepository.getCapas();
    res.render('quality/capa', { user: req.user, capas });
  });

  addCapa = asyncHandler(async (req, res) => {
    const { ncrId, title, rootCauseMethod, rootCauseDescription, correctiveAction, preventiveAction, targetDate, status, assignedTo, verifiedBy } = req.body;
    await qualityRepository.createCapa({
      ncrId: ncrId ? parseInt(ncrId) : null,
      title,
      rootCauseMethod,
      rootCauseDescription,
      correctiveAction,
      preventiveAction,
      targetDate: targetDate || null,
      status,
      assignedTo,
      verifiedBy
    });
    res.redirect('/quality/capa');
  });

  // 4. Lot/Seri İzlenebilirlik (Traceability Tree)
  showTraceability = asyncHandler(async (req, res) => {
    const lotNumber = req.query.lotNumber || 'LOT-2026-A101';
    const traceData = await qualityRepository.getLotTraceability(lotNumber);
    res.render('quality/traceability', { user: req.user, traceData, searchLot: lotNumber });
  });

  // 5. Kalibrasyon & Ölçüm Cihazları
  listEquipments = asyncHandler(async (req, res) => {
    const equipments = await qualityRepository.getEquipments();
    res.render('quality/equipment', { user: req.user, equipments });
  });

  addEquipment = asyncHandler(async (req, res) => {
    const { name, category, brandModel, serialNo, calibrationPeriodMonths, lastCalibrationDate, nextCalibrationDate, status, calibrationLab, notes } = req.body;
    await qualityRepository.createEquipment({
      name,
      category,
      brandModel,
      serialNo,
      calibrationPeriodMonths: parseInt(calibrationPeriodMonths) || 12,
      lastCalibrationDate: lastCalibrationDate || null,
      nextCalibrationDate: nextCalibrationDate || null,
      status,
      calibrationLab,
      notes
    });
    res.redirect('/quality/equipment');
  });

  // 6. ISO Belgeleri & Dokümanlar
  listDocuments = asyncHandler(async (req, res) => {
    const documents = await qualityRepository.getDocuments();
    res.render('quality/documents', { user: req.user, documents });
  });

  addDocument = asyncHandler(async (req, res) => {
    const { docCode, title, category, revisionNo, effectiveDate, owner, status, fileUrl, description } = req.body;
    await qualityRepository.createDocument({
      docCode,
      title,
      category,
      revisionNo,
      effectiveDate: effectiveDate || null,
      owner,
      status,
      fileUrl,
      description
    });
    res.redirect('/quality/documents');
  });
}

module.exports = new QualityController();
