const purchaseRepository = require('../repositories/purchaseRepository');
const supplierRepository = require('../repositories/supplierRepository');
const rfqRepository = require('../repositories/rfqRepository');
const goodsReceiptRepository = require('../repositories/goodsReceiptRepository');
const requisitionRepository = require('../repositories/requisitionRepository');
const stockRepository = require('../repositories/stockRepository');
const { ValidationError, NotFoundError } = require('../utils/appError');
const { SatinAlmaSiparisi, SatinAlmaTeklifTalebi, MalKabul, Tedarikci, SatinAlmaTalebi, StokKarti, sequelize } = require('../../models');
const { Op, fn, col, literal } = require('sequelize');

class PurchaseService {
  // ═══════════════════════ PURCHASE ORDERS ═══════════════════════
  async getAllOrders(filters = {}) {
    return await purchaseRepository.findAll(filters);
  }

  async getOrderById(id) {
    const order = await purchaseRepository.findById(id);
    if (!order) throw new NotFoundError('Satın alma siparişi bulunamadı.');
    return order;
  }

  async createOrder(data, currentUser, ipAddress) {
    const existing = await purchaseRepository.findByOrderNo(data.siparisNo || data.orderNo);
    if (existing) {
      throw new ValidationError('Bu satın alma sipariş numarası zaten mevcuttur.');
    }

    const stokId = data.stokId || data.stockItemId;
    const stockItem = await stockRepository.findById(stokId);
    if (!stockItem) {
      throw new ValidationError('Seçilen stok kartı / malzeme bulunamadı.');
    }

    const quantity = parseFloat(data.miktar !== undefined ? data.miktar : data.quantity) || 0;
    const unitPrice = parseFloat(data.birimFiyat !== undefined ? data.birimFiyat : data.unitPrice) || 0;
    const discountRate = parseFloat(data.iskontoOrani !== undefined ? data.iskontoOrani : data.discountRate) || 0;
    const taxRate = parseFloat(data.kdvOrani !== undefined ? data.kdvOrani : data.taxRate) || 20;

    if (quantity <= 0) throw new ValidationError('Sipariş miktarı sıfırdan büyük olmalıdır.');
    if (unitPrice < 0) throw new ValidationError('Birim alış fiyatı negatif olamaz.');

    const subtotal = quantity * unitPrice;
    const discountAmount = subtotal * (discountRate / 100);
    const amountAfterDiscount = subtotal - discountAmount;
    const taxAmount = amountAfterDiscount * (taxRate / 100);
    const totalAmount = amountAfterDiscount + taxAmount;

    let status = data.durum || data.status || 'Ordered';
    if (totalAmount > 50000) {
      status = 'Pending_Approval';
    }

    const computedData = {
      ...data,
      durum: status,
      araToplam: parseFloat(subtotal.toFixed(4)),
      iskontoTutari: parseFloat(discountAmount.toFixed(4)),
      kdvTutari: parseFloat(taxAmount.toFixed(4)),
      toplamTutar: parseFloat(totalAmount.toFixed(4))
    };

    return await purchaseRepository.create(computedData, currentUser, ipAddress);
  }

  async updateOrder(id, data, currentUser, ipAddress) {
    const order = await purchaseRepository.update(id, data, currentUser, ipAddress);
    if (!order) throw new NotFoundError('Güncellenecek satın alma siparişi bulunamadı.');
    return order;
  }

  async deleteOrder(id, currentUser, ipAddress) {
    const result = await purchaseRepository.delete(id, currentUser, ipAddress);
    if (!result) throw new NotFoundError('Silinecek satın alma siparişi bulunamadı.');
    return result;
  }

  async getNextOrderNo() {
    return await purchaseRepository.getNextOrderNo();
  }

  async getStats() {
    return await purchaseRepository.getStats();
  }

  // ═══════════════════════ SUPPLIERS ═══════════════════════
  async getAllSuppliers(filters = {}) {
    return await supplierRepository.findAll(filters);
  }

  async getSupplierById(id) {
    const supplier = await supplierRepository.findById(id);
    if (!supplier) throw new NotFoundError('Tedarikçi bulunamadı.');
    return supplier;
  }

  async getSupplierWithOrders(id) {
    const supplier = await supplierRepository.getSupplierWithOrders(id);
    if (!supplier) throw new NotFoundError('Tedarikçi bulunamadı.');
    return supplier;
  }

  async createSupplier(data, currentUser, ipAddress) {
    const existing = await supplierRepository.findByCode(data.tedarikciKodu || data.supplierCode);
    if (existing) {
      throw new ValidationError('Bu tedarikçi kodu zaten mevcuttur.');
    }
    return await supplierRepository.create(data, currentUser, ipAddress);
  }

  async updateSupplier(id, data, currentUser, ipAddress) {
    const supplier = await supplierRepository.update(id, data, currentUser, ipAddress);
    if (!supplier) throw new NotFoundError('Tedarikçi bulunamadı.');
    return supplier;
  }

  async getNextSupplierCode() {
    return await supplierRepository.getNextCode();
  }

  async getSupplierStats() {
    return await supplierRepository.getStats();
  }

  // ═══════════════════════ RFQ ═══════════════════════
  async getAllRfqs(filters = {}) {
    return await rfqRepository.findAll(filters);
  }

  async getRfqById(id) {
    const rfq = await rfqRepository.findById(id);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');
    return rfq;
  }

  async createRfq(data, currentUser, ipAddress) {
    return await rfqRepository.create(data, currentUser, ipAddress);
  }

  async updateRfq(id, data, currentUser, ipAddress) {
    const rfq = await rfqRepository.update(id, data, currentUser, ipAddress);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');
    return rfq;
  }

  async deleteRfq(id, currentUser, ipAddress) {
    const rfq = await rfqRepository.findById(id);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');
    return await rfqRepository.delete(id, currentUser, ipAddress);
  }

  async rejectRfq(id, currentUser, ipAddress) {
    const rfq = await rfqRepository.findById(id);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');
    return await rfqRepository.update(id, { durum: 'Rejected' }, currentUser, ipAddress);
  }

  async acceptRfq(id, currentUser, ipAddress) {
    const rfqId = parseInt(id, 10);
    const rfq = await rfqRepository.findById(rfqId);
    if (!rfq) throw new NotFoundError('Teklif bulunamadı.');

    await SatinAlmaTeklifTalebi.update({ durum: 'Accepted', kazananMi: true }, { where: { id: rfqId } });

    let itemsList = [];
    if (rfq.kalemlerVerisi && Array.isArray(rfq.kalemlerVerisi) && rfq.kalemlerVerisi.length > 0) {
      itemsList = rfq.kalemlerVerisi;
    } else if (rfq.stokId || rfq.stokKarti) {
      const sItem = rfq.stokKarti || {};
      const qty = parseFloat(rfq.talepEdilenMiktar) || 1;
      const uPrice = parseFloat(rfq.teklifEdilenBirimFiyat) || 0;
      const sub = qty * uPrice;
      itemsList = [{
        stokId: rfq.stokId || sItem.id,
        stokKodu: sItem.stokKodu || 'STK',
        ad: sItem.ad || 'Ürün',
        birim: sItem.birim || 'Adet',
        requisitionNo: 'TAL-GENEL',
        quantity: qty,
        unitPrice: uPrice,
        discountRate: 0,
        vatRate: 20,
        netAmount: sub * 1.2
      }];
    }

    const itemsJson = JSON.stringify(itemsList);

    const subtotal = parseFloat(rfq.araToplam) || parseFloat(rfq.teklifEdilenToplamFiyat) || 0;
    const totalDiscount = parseFloat(rfq.toplamIskonto) || 0;
    const totalTax = parseFloat(rfq.toplamKdv) || 0;
    const grandTotal = parseFloat(rfq.teklifEdilenToplamFiyat) || (subtotal - totalDiscount + totalTax);

    const nextOrderNo = await this.getNextOrderNo();
    const deliveryDays = parseInt(rfq.teslimSuresiGun, 10) || 7;
    const expDelivery = new Date(Date.now() + deliveryDays * 86400000).toISOString().split('T')[0];

    const supplierTaxNo = rfq.tedarikci ? (rfq.tedarikci.vergiNo || '') : '';
    const supplierContactPerson = rfq.tedarikci ? (rfq.tedarikci.ilgiliKisi || '') : '';
    const supplierEmail = rfq.tedarikci ? (rfq.tedarikci.eposta || '') : '';
    const supplierPhone = rfq.tedarikci ? (rfq.tedarikci.telefon || '') : '';

    const firstItem = itemsList[0] || {};
    const firstStockId = firstItem.stokId || firstItem.stockItemId || rfq.stokId || 1;

    const newOrder = await this.createOrder({
      siparisNo: nextOrderNo,
      tedarikciAdi: rfq.tedarikciAdi || (rfq.tedarikci ? rfq.tedarikci.firmaAdi : 'Tedarikçi Firma'),
      tedarikciId: rfq.tedarikciId,
      tedarikciVergiNo: supplierTaxNo,
      tedarikciIlgiliKisi: supplierContactPerson,
      tedarikciEposta: supplierEmail,
      tedarikciTelefon: supplierPhone,
      siparisTarihi: new Date().toISOString().split('T')[0],
      beklenenTeslimTarihi: expDelivery,
      odemeVadesi: rfq.odemeVadesi || 'Pesin',
      durum: 'Ordered',
      oncelik: 'Normal',
      stokId: parseInt(firstStockId, 10),
      miktar: parseFloat(firstItem.quantity || firstItem.miktar) || parseFloat(rfq.talepEdilenMiktar) || 1,
      birimFiyat: parseFloat(firstItem.unitPrice || firstItem.birimFiyat) || parseFloat(rfq.teklifEdilenBirimFiyat) || 0,
      araToplam: subtotal,
      iskontoTutari: totalDiscount,
      kdvTutari: totalTax,
      toplamTutar: grandTotal,
      paraBirimi: rfq.paraBirimi || 'TRY',
      notlar: rfq.notlar || `[Sözleşmeli Teklif No: ${rfq.teklifTalepNo}] Teklifi kabul edilerek otomatik oluşturulan satın alma siparişidir.`,
      satinAlmaci: currentUser ? (currentUser.ad ? `${currentUser.ad} ${currentUser.soyad}` : currentUser.kullaniciAdi) : 'Sistem',
      kalemlerJson: itemsJson
    }, currentUser, ipAddress);

    return newOrder;
  }

  async getNextRfqNo() {
    return await rfqRepository.getNextRfqNo();
  }

  async getRfqStats() {
    return await rfqRepository.getStats();
  }

  // ═══════════════════════ GOODS RECEIPT ═══════════════════════
  async getAllGoodsReceipts(filters = {}) {
    return await goodsReceiptRepository.findAll(filters);
  }

  async getGoodsReceiptById(id) {
    const grn = await goodsReceiptRepository.findById(id);
    if (!grn) throw new NotFoundError('Mal kabul fişi bulunamadı.');
    return grn;
  }

  async createGoodsReceipt(data, currentUser, ipAddress) {
    return await goodsReceiptRepository.create(data, currentUser, ipAddress);
  }

  async getNextGrnNo() {
    return await goodsReceiptRepository.getNextGrnNo();
  }

  async getGoodsReceiptStats() {
    return await goodsReceiptRepository.getStats();
  }

  // ═══════════════════════ REQUISITIONS ═══════════════════════
  async getAllRequisitions(filters = {}) {
    return await requisitionRepository.findAll(filters);
  }

  async createRequisition(data, currentUser, ipAddress) {
    return await requisitionRepository.create(data, currentUser, ipAddress);
  }

  async getNextRequisitionNo() {
    return await requisitionRepository.getNextRequisitionNo();
  }

  // ═══════════════════════ APPROVALS ═══════════════════════
  async getPendingApprovals() {
    const pendingOrders = await SatinAlmaSiparisi.findAll({
      where: { durum: 'Pending_Approval' },
      include: [
        { model: StokKarti, as: 'stokKarti', attributes: ['id', 'stokKodu', 'ad', 'birim'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return { pendingOrders, pendingRequisitions: [] };
  }

  async approveOrder(id, action, currentUser, ipAddress) {
    const order = await purchaseRepository.findById(id);
    if (!order) throw new NotFoundError('Sipariş bulunamadı.');

    if (action === 'approve') {
      await purchaseRepository.update(id, { durum: 'Ordered' }, currentUser, ipAddress);
    } else if (action === 'reject') {
      await purchaseRepository.update(id, { durum: 'Cancelled' }, currentUser, ipAddress);
    }
    return order;
  }

  async approveRequisition(id, action, currentUser, ipAddress) {
    const req = await SatinAlmaTalebi.findByPk(id);
    if (!req) throw new NotFoundError('Talep bulunamadı.');

    if (action === 'approve') {
      await requisitionRepository.updateStatus(id, 'Approved', currentUser, ipAddress);
    } else if (action === 'reject') {
      await requisitionRepository.updateStatus(id, 'Rejected', currentUser, ipAddress);
    }
    return req;
  }

  // ═══════════════════════ ANALYTICS ═══════════════════════
  async getAnalyticsData() {
    const stats = await purchaseRepository.getStats();
    const supplierStats = await supplierRepository.getStats();
    const rfqStats = await rfqRepository.getStats();
    const grnStats = await goodsReceiptRepository.getStats();

    const supplierSpend = await SatinAlmaSiparisi.findAll({
      attributes: [
        'tedarikciAdi',
        [fn('COUNT', col('id')), 'orderCount'],
        [fn('SUM', col('toplamTutar')), 'totalSpend']
      ],
      where: { durum: { [Op.ne]: 'Cancelled' } },
      group: ['tedarikciAdi'],
      order: [[fn('SUM', col('toplamTutar')), 'DESC']],
      limit: 10,
      raw: true
    });

    const monthlySpend = await SatinAlmaSiparisi.findAll({
      attributes: [
        [fn('DATE_TRUNC', 'month', col('siparisTarihi')), 'month'],
        [fn('SUM', col('toplamTutar')), 'total']
      ],
      where: { durum: { [Op.ne]: 'Cancelled' } },
      group: [fn('DATE_TRUNC', 'month', col('siparisTarihi'))],
      order: [[fn('DATE_TRUNC', 'month', col('siparisTarihi')), 'ASC']],
      limit: 6,
      raw: true
    }).catch(() => []);

    const topItems = await SatinAlmaSiparisi.findAll({
      attributes: [
        'stokId',
        [fn('SUM', col('SatinAlmaSiparisi.miktar')), 'totalQty'],
        [fn('SUM', col('toplamTutar')), 'totalSpend']
      ],
      include: [{ model: StokKarti, as: 'stokKarti', attributes: ['ad', 'stokKodu'] }],
      where: { durum: { [Op.ne]: 'Cancelled' } },
      group: ['stokId', 'stokKarti.id', 'stokKarti.ad', 'stokKarti.stokKodu'],
      order: [[fn('SUM', col('toplamTutar')), 'DESC']],
      limit: 5,
      raw: true,
      nest: true
    }).catch(() => []);

    const recentOrders = await SatinAlmaSiparisi.findAll({
      include: [{ model: StokKarti, as: 'stokKarti', attributes: ['ad', 'stokKodu'] }],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    return {
      stats,
      supplierStats,
      rfqStats,
      grnStats,
      supplierSpend,
      monthlySpend,
      topItems,
      recentOrders
    };
  }
}

module.exports = new PurchaseService();
