const { DenetimKaydi, Kullanici } = require('../../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class LogService {
  async logCrud(logData) {
    const userId = logData.userId || logData.kullaniciId;
    const username = logData.username || logData.kullaniciAdi;
    const action = logData.action || logData.islem;
    const entity = logData.entity || logData.varlik;
    const entityId = logData.entityId || logData.varlikId;
    const details = logData.details || logData.detaylar;
    const ipAddress = logData.ipAddress || logData.ipAdresi;

    let detailsStr = '';
    const performer = username || (userId ? `Kullanıcı #${userId}` : 'Sistem Personeli');
    
    const entityNameMap = {
      'User': 'Kullanıcı Hesabı',
      'Kullanici': 'Kullanıcı Hesabı',
      'StockItem': 'Stok Malzeme Kartı',
      'StokKarti': 'Stok Malzeme Kartı',
      'StockLot': 'Lot / Parti İzi',
      'StokPartisi': 'Lot / Parti İzi',
      'StockMovement': 'Stok Hareket Fişi',
      'StokHareketi': 'Stok Hareket Fişi',
      'StockCounting': 'Stok Sayım Fişi',
      'StokSayimi': 'Stok Sayım Fişi',
      'Warehouse': 'Depo / Ambar',
      'Depo': 'Depo / Ambar',
      'SaleOrder': 'Satış Siparişi',
      'SatisSiparisi': 'Satış Siparişi',
      'SaleQuote': 'Satış Teklifi',
      'SatisTeklifi': 'Satış Teklifi',
      'Customer': 'Müşteri Cari Kartı',
      'MusteriHesabi': 'Müşteri Cari Kartı',
      'Dispatch': 'İrsaliye / Sevkiyat',
      'SatisIrsaliyesi': 'İrsaliye / Sevkiyat',
      'Invoice': 'Fatura',
      'SatisFaturasi': 'Fatura',
      'PurchaseOrder': 'Satın Alma Siparişi',
      'SatinAlmaSiparisi': 'Satın Alma Siparişi',
      'PurchaseRfq': 'Teklif Talebi (RFQ)',
      'SatinAlmaTeklifTalebi': 'Teklif Talebi (RFQ)',
      'Supplier': 'Tedarikçi Kartı',
      'Tedarikci': 'Tedarikçi Kartı',
      'GoodsReceipt': 'Mal Kabul Fişi',
      'MalKabul': 'Mal Kabul Fişi',
      'ProductionOrder': 'Üretim İş Emri',
      'UretimEmri': 'Üretim İş Emri',
      'BOMItem': 'Ürün Reçetesi (BOM)',
      'UrunRecetesi': 'Ürün Reçetesi (BOM)',
      'RoutingOperation': 'Üretim Rotalama Operasyonu',
      'RotaOperasyon': 'Üretim Rotalama Operasyonu',
      'QualityInspection': 'Kalite Kontrol Muayenesi',
      'KaliteMuayene': 'Kalite Kontrol Muayenesi',
      'QualityNonConformance': 'Uygunsuzluk (NCR) Kaydı',
      'KaliteUygunsuzluk': 'Uygunsuzluk (NCR) Kaydı',
      'QualityCapa': 'Düzeltici Aksiyon (CAPA)',
      'KaliteDof': 'Düzeltici Aksiyon (CAPA)',
      'QualityEquipment': 'Ölçüm Cihazı / Ekipman',
      'KaliteEkipmani': 'Ölçüm Cihazı / Ekipman',
      'QualityDocument': 'ISO Kalite Dokümanı',
      'KaliteDokumani': 'ISO Kalite Dokümanı',
      'SystemSetting': 'Sistem Parametresi',
      'SistemAyari': 'Sistem Parametresi'
    };

    const friendlyEntity = entityNameMap[entity] || entity;
    const actionVerbMap = {
      'CREATE': 'ekledi',
      'UPDATE': 'güncelledi',
      'DELETE': 'sildi',
      'READ': 'inceledi'
    };
    const verb = actionVerbMap[action] || 'işlem yaptı';

    if (typeof details === 'object' && details !== null) {
      if (details.kullaniciAdi || details.username) {
        detailsStr = `${performer}, @${details.kullaniciAdi || details.username} adında yeni ${friendlyEntity} ${verb}.`;
      } else {
        detailsStr = `${performer}, ${friendlyEntity} (ID: #${entityId || ''}) kayıt bilgilerini ${verb}.`;
      }
    } else if (typeof details === 'string' && details.trim().length > 0) {
      if (details.includes(performer) || details.includes(verb)) {
        detailsStr = details;
      } else {
        detailsStr = `${performer}, ${friendlyEntity} bilgilerini ${verb}: ${details}`;
      }
    } else {
      detailsStr = `${performer}, ${friendlyEntity} üzerinde ${verb} işlemini gerçekleştirdi.`;
    }

    logger.crud(`${action} on ${entity} (ID: ${entityId || 'N/A'}) by user ${username || userId || 'System'}`, {
      entity,
      entityId,
      details: detailsStr,
      ipAddress
    });

    try {
      await DenetimKaydi.create({
        kullaniciId: userId || null,
        kullaniciAdi: username || 'System',
        islem: action || 'CREATE',
        varlik: entity || 'General',
        varlikId: entityId ? String(entityId) : null,
        detaylar: detailsStr,
        ipAdresi: ipAddress || null
      });
    } catch (err) {
      logger.error('Failed to insert DenetimKaydi into Database', err);
    }
  }

  async getRecentLogs(limit = 150, filters = {}) {
    const where = {};

    if (filters.action && ['CREATE', 'READ', 'UPDATE', 'DELETE'].includes(filters.action)) {
      where.islem = filters.action;
    }

    if (filters.entity) {
      where.varlik = { [Op.iLike || Op.like]: `%${filters.entity}%` };
    }

    if (filters.search) {
      where[Op.or] = [
        { kullaniciAdi: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { detaylar: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { varlik: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await DenetimKaydi.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      include: [{ model: Kullanici, as: 'kullanici', attributes: ['id', 'kullaniciAdi', 'ad', 'soyad', 'eposta', 'departman', 'rol'] }]
    });
  }
}

module.exports = new LogService();
