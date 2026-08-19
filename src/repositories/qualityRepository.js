const {
  KaliteMuayene,
  KaliteUygunsuzluk,
  KaliteDof,
  KaliteEkipmani,
  KaliteDokumani,
  StokKarti,
  Tedarikci,
  UretimEmri,
  StokPartisi,
  StokHareketi,
  MalKabul,
  SatisSiparisi
} = require('../../models');

class QualityRepository {
  // Inspections
  async getInspections(tur = null) {
    const where = {};
    if (tur) where.tur = tur;

    return await KaliteMuayene.findAll({
      where,
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: Tedarikci, as: 'tedarikci' },
        { model: UretimEmri, as: 'uretimEmri' }
      ],
      order: [['id', 'DESC']]
    });
  }

  async createInspection(data) {
    const count = await KaliteMuayene.count();
    const typeVal = data.tur || data.type || 'Incoming';
    const prefix = typeVal === 'Incoming' ? 'IQC' : (typeVal === 'InProcess' ? 'IPQC' : 'FQC');
    
    const cleanData = {
      muayeneNo: data.muayeneNo || data.inspectionNo || `${prefix}-2026-${String(count + 1).padStart(4, '0')}`,
      tur: typeVal,
      stokId: data.stokId || data.stockItemId,
      partiNo: data.partiNo || data.lotNumber,
      tedarikciId: data.tedarikciId || data.supplierId,
      uretimEmriId: data.uretimEmriId || data.productionOrderId,
      numuneMiktari: data.numuneMiktari !== undefined ? data.numuneMiktari : (data.sampleSize || 1),
      kabulMiktari: data.kabulMiktari !== undefined ? data.kabulMiktari : (data.passedQuantity || 0),
      redMiktari: data.redMiktari !== undefined ? data.redMiktari : (data.rejectedQuantity || 0),
      karar: data.karar || data.decision || 'Accepted',
      denetciAdi: data.denetciAdi || data.inspectorName,
      hataKategorisi: data.hataKategorisi || data.defectCategory,
      notlar: data.notlar || data.notes,
      muayeneTarihi: data.muayeneTarihi || data.inspectedAt || new Date()
    };

    return await KaliteMuayene.create(cleanData);
  }

  // Non-Conformances (NCR)
  async getNcrs() {
    return await KaliteUygunsuzluk.findAll({
      include: [
        { model: StokKarti, as: 'stokKarti' },
        { model: KaliteDof, as: 'doflar' }
      ],
      order: [['id', 'DESC']]
    });
  }

  async createNcr(data) {
    const count = await KaliteUygunsuzluk.count();
    const cleanData = {
      uygunsuzlukNo: data.uygunsuzlukNo || data.ncrNo || `NCR-2026-${String(count + 1).padStart(4, '0')}`,
      baslik: data.baslik || data.title,
      tur: data.tur || data.type || 'Material',
      ciddiyet: data.ciddiyet || data.severity || 'Major',
      durum: data.durum || data.status || 'Open',
      stokId: data.stokId || data.stockItemId,
      partiNo: data.partiNo || data.lotNumber,
      etkilenenMiktar: data.etkilenenMiktar !== undefined ? data.etkilenenMiktar : (data.quantityAffected || 1),
      tespitEden: data.tespitEden || data.detectedBy,
      atananKisi: data.atananKisi || data.assignedTo,
      aciklama: data.aciklama || data.description,
      kararVeIslem: data.kararVeIslem || data.disposition || 'Rework'
    };
    return await KaliteUygunsuzluk.create(cleanData);
  }

  // CAPA
  async getCapas() {
    return await KaliteDof.findAll({
      include: [{ model: KaliteUygunsuzluk, as: 'uygunsuzluk' }],
      order: [['id', 'DESC']]
    });
  }

  async createCapa(data) {
    const count = await KaliteDof.count();
    const cleanData = {
      dofNo: data.dofNo || data.capaNo || `CAPA-2026-${String(count + 1).padStart(4, '0')}`,
      uygunsuzlukId: data.uygunsuzlukId || data.ncrId,
      baslik: data.baslik || data.title,
      kokNedenYontemi: data.kokNedenYontemi || data.rootCauseMethod || '5_Why',
      kokNedenAciklamasi: data.kokNedenAciklamasi || data.rootCauseDescription,
      duzelticiFaaliyet: data.duzelticiFaaliyet || data.correctiveAction,
      onleyiciFaaliyet: data.onleyiciFaaliyet || data.preventiveAction,
      hedefTarih: data.hedefTarih || data.targetDate,
      durum: data.durum || data.status || 'In_Progress',
      atananKisi: data.atananKisi || data.assignedTo,
      onaylayanKisi: data.onaylayanKisi || data.verifiedBy
    };
    return await KaliteDof.create(cleanData);
  }

  // Equipment & Calibration
  async getEquipments() {
    return await KaliteEkipmani.findAll({
      order: [['gelecekKalibrasyonTarihi', 'ASC']]
    });
  }

  async createEquipment(data) {
    const count = await KaliteEkipmani.count();
    const cleanData = {
      ekipmanKodu: data.ekipmanKodu || data.equipmentCode || `CAL-${String(count + 1).padStart(3, '0')}`,
      ad: data.ad || data.name,
      kategori: data.kategori || data.category || 'Dimension',
      markaModel: data.markaModel || data.brandModel,
      seriNo: data.seriNo || data.serialNo,
      kalibrasyonPeriyoduAy: data.kalibrasyonPeriyoduAy !== undefined ? data.kalibrasyonPeriyoduAy : (data.calibrationPeriodMonths || 12),
      sonKalibrasyonTarihi: data.sonKalibrasyonTarihi || data.lastCalibrationDate,
      gelecekKalibrasyonTarihi: data.gelecekKalibrasyonTarihi || data.nextCalibrationDate,
      durum: data.durum || data.status || 'Valid',
      kalibrasyonLaboratuvari: data.kalibrasyonLaboratuvari || data.calibrationLab,
      notlar: data.notlar || data.notes
    };
    return await KaliteEkipmani.create(cleanData);
  }

  // ISO Documents
  async getDocuments() {
    return await KaliteDokumani.findAll({
      order: [['dokumanKodu', 'ASC']]
    });
  }

  async createDocument(data) {
    const cleanData = {
      dokumanKodu: data.dokumanKodu || data.docCode,
      baslik: data.baslik || data.title,
      kategori: data.kategori || data.category || 'Procedure',
      revizyonNo: data.revizyonNo || data.revisionNo || 'Rev.01',
      gecerlilikTarihi: data.gecerlilikTarihi || data.effectiveDate,
      sorumlu: data.sorumlu || data.owner,
      durum: data.durum || data.status || 'Active',
      dosyaYolu: data.dosyaYolu || data.fileUrl,
      aciklama: data.aciklama || data.description
    };
    return await KaliteDokumani.create(cleanData);
  }

  // Traceability Engine (Lot/Serial Genealogy Tree)
  async getLotTraceability(lotNumber) {
    if (!lotNumber) lotNumber = 'LOT-2026-A101';

    let lot = null;
    try {
      lot = await StokPartisi.findOne({
        where: { partiNo: lotNumber },
        include: [{ model: StokKarti, as: 'stokKarti' }]
      });
    } catch (err) {
      console.error('Error fetching lot:', err.message);
    }

    let movements = [];
    try {
      movements = await StokHareketi.findAll({
        limit: 5,
        order: [['createdAt', 'DESC']]
      });
    } catch (err) {
      console.error('Error fetching movements:', err.message);
    }

    let inspections = [];
    try {
      inspections = await KaliteMuayene.findAll({
        where: { partiNo: lotNumber },
        include: [{ model: StokKarti, as: 'stokKarti' }, { model: Tedarikci, as: 'tedarikci' }]
      });
    } catch (err) {
      console.error('Error fetching inspections:', err.message);
    }

    let ncrs = [];
    try {
      ncrs = await KaliteUygunsuzluk.findAll({
        where: { partiNo: lotNumber },
        include: [{ model: KaliteDof, as: 'doflar' }]
      });
    } catch (err) {
      console.error('Error fetching ncrs:', err.message);
    }

    let goodsReceipts = [];
    try {
      goodsReceipts = await MalKabul.findAll({
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
    const totalInspections = await KaliteMuayene.count();
    const passedInspections = await KaliteMuayene.count({ where: { karar: 'Accepted' } });
    const openNcrs = await KaliteUygunsuzluk.count({ where: { durum: ['Open', 'Under_Investigation', 'Action_Required'] } });
    const activeCapas = await KaliteDof.count({ where: { durum: ['In_Progress', 'Verification_Pending'] } });
    const dueCalibrations = await KaliteEkipmani.count({ where: { durum: ['Due_Soon', 'Expired'] } });

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
