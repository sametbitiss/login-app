const {
  QualityInspection,
  QualityNonConformance,
  QualityCapa,
  QualityEquipment,
  QualityDocument,
  StockItem,
  Supplier,
  ProductionOrder,
  StockLot,
  StockMovement,
  GoodsReceipt,
  SaleOrder
} = require('../../models');

class QualityRepository {
  // Inspections
  async getInspections(type = null) {
    const where = {};
    if (type) where.type = type;

    return await QualityInspection.findAll({
      where,
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: Supplier, as: 'supplier' },
        { model: ProductionOrder, as: 'productionOrder' }
      ],
      order: [['id', 'DESC']]
    });
  }

  async createInspection(data) {
    // Generate code
    const count = await QualityInspection.count();
    const prefix = data.type === 'Incoming' ? 'IQC' : (data.type === 'InProcess' ? 'IPQC' : 'FQC');
    data.inspectionNo = `${prefix}-2026-${String(count + 1).padStart(4, '0')}`;

    return await QualityInspection.create(data);
  }

  // Non-Conformances (NCR)
  async getNcrs() {
    return await QualityNonConformance.findAll({
      include: [
        { model: StockItem, as: 'stockItem' },
        { model: QualityCapa, as: 'capas' }
      ],
      order: [['id', 'DESC']]
    });
  }

  async createNcr(data) {
    const count = await QualityNonConformance.count();
    data.ncrNo = `NCR-2026-${String(count + 1).padStart(4, '0')}`;
    return await QualityNonConformance.create(data);
  }

  // CAPA
  async getCapas() {
    return await QualityCapa.findAll({
      include: [{ model: QualityNonConformance, as: 'ncr' }],
      order: [['id', 'DESC']]
    });
  }

  async createCapa(data) {
    const count = await QualityCapa.count();
    data.capaNo = `CAPA-2026-${String(count + 1).padStart(4, '0')}`;
    return await QualityCapa.create(data);
  }

  // Equipment & Calibration
  async getEquipments() {
    return await QualityEquipment.findAll({
      order: [['nextCalibrationDate', 'ASC']]
    });
  }

  async createEquipment(data) {
    const count = await QualityEquipment.count();
    data.equipmentCode = `CAL-${String(count + 1).padStart(3, '0')}`;
    return await QualityEquipment.create(data);
  }

  // ISO Documents
  async getDocuments() {
    return await QualityDocument.findAll({
      order: [['docCode', 'ASC']]
    });
  }

  async createDocument(data) {
    return await QualityDocument.create(data);
  }

  // Traceability Engine (Lot/Serial Genealogy Tree)
  async getLotTraceability(lotNumber) {
    if (!lotNumber) lotNumber = 'LOT-2026-A101';

    let lot = null;
    try {
      lot = await StockLot.findOne({
        where: { lotNumber },
        include: [{ model: StockItem, as: 'stockItem' }]
      });
    } catch (err) {
      console.error('Error fetching lot:', err.message);
    }

    let movements = [];
    try {
      movements = await StockMovement.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']]
      });
    } catch (err) {
      console.error('Error fetching movements:', err.message);
    }

    let inspections = [];
    try {
      inspections = await QualityInspection.findAll({
        where: { lotNumber },
        include: [{ model: StockItem, as: 'stockItem' }, { model: Supplier, as: 'supplier' }]
      });
    } catch (err) {
      console.error('Error fetching inspections:', err.message);
    }

    let ncrs = [];
    try {
      ncrs = await QualityNonConformance.findAll({
        where: { lotNumber },
        include: [{ model: QualityCapa, as: 'capas' }]
      });
    } catch (err) {
      console.error('Error fetching ncrs:', err.message);
    }

    let goodsReceipts = [];
    try {
      goodsReceipts = await GoodsReceipt.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']]
      });
    } catch (err) {
      console.error('Error fetching goodsReceipts:', err.message);
    }

    return {
      lot,
      lotNumber,
      movements,
      inspections,
      ncrs,
      goodsReceipts
    };
  }

  // Analytics Metrics
  async getAnalytics() {
    const totalInspections = await QualityInspection.count();
    const passedInspections = await QualityInspection.count({ where: { decision: 'Accepted' } });
    const openNcrs = await QualityNonConformance.count({ where: { status: ['Open', 'Under_Investigation', 'Action_Required'] } });
    const activeCapas = await QualityCapa.count({ where: { status: ['In_Progress', 'Verification_Pending'] } });
    const dueCalibrations = await QualityEquipment.count({ where: { status: ['Due_Soon', 'Expired'] } });

    const passRate = totalInspections > 0 ? ((passedInspections / totalInspections) * 100).toFixed(1) : 100;

    return {
      totalInspections,
      passedInspections,
      passRate,
      openNcrs,
      activeCapas,
      dueCalibrations
    };
  }
}

module.exports = new QualityRepository();
