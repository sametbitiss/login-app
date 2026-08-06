const { AuditLog, User } = require('../../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class LogService {
  async logCrud({ userId, username, action, entity, entityId, details, ipAddress }) {
    let detailsStr = '';
    const performer = username || (userId ? `Kullanıcı #${userId}` : 'Sistem Personeli');
    
    const entityNameMap = {
      'User': 'Kullanıcı Hesabı',
      'StockItem': 'Stok Malzeme Kartı',
      'StockLot': 'Lot / Parti İzi',
      'StockMovement': 'Stok Hareket Fişi',
      'StockCounting': 'Stok Sayım Fişi',
      'Warehouse': 'Depo / Ambar',
      'SaleOrder': 'Satış Siparişi',
      'SaleQuote': 'Satış Teklifi',
      'Customer': 'Müşteri Cari Kartı',
      'Dispatch': 'İrsaliye / Sevkiyat',
      'Invoice': 'Fatura',
      'PurchaseOrder': 'Satın Alma Siparişi',
      'PurchaseRfq': 'Teklif Talebi (RFQ)',
      'Supplier': 'Tedarikçi Kartı',
      'GoodsReceipt': 'Mal Kabul Fişi',
      'ProductionOrder': 'Üretim İş Emri',
      'BOMItem': 'Ürün Reçetesi (BOM)',
      'RoutingOperation': 'Üretim Rotalama Operasyonu',
      'QualityInspection': 'Kalite Kontrol Muayenesi',
      'QualityNonConformance': 'Uygunsuzluk (NCR) Kaydı',
      'QualityCapa': 'Düzeltici Aksiyon (CAPA)',
      'QualityEquipment': 'Ölçüm Cihazı / Ekipman',
      'QualityDocument': 'ISO Kalite Dokümanı',
      'SystemSetting': 'Sistem Parametresi'
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
      if (details.username) {
        detailsStr = `${performer}, @${details.username} adında yeni ${friendlyEntity} ${verb}.`;
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
      await AuditLog.create({
        userId: userId || null,
        username: username || 'System',
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        details: detailsStr,
        ipAddress: ipAddress || null
      });
    } catch (err) {
      logger.error('Failed to insert AuditLog into Database', err);
    }
  }

  async getRecentLogs(limit = 150, filters = {}) {
    const where = {};

    if (filters.action && ['CREATE', 'READ', 'UPDATE', 'DELETE'].includes(filters.action)) {
      where.action = filters.action;
    }

    if (filters.entity) {
      where.entity = { [Op.iLike || Op.like]: `%${filters.entity}%` };
    }

    if (filters.search) {
      where[Op.or] = [
        { username: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { details: { [Op.iLike || Op.like]: `%${filters.search}%` } },
        { entity: { [Op.iLike || Op.like]: `%${filters.search}%` } }
      ];
    }

    return await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'firstName', 'lastName', 'email', 'department', 'role'] }]
    });
  }
}

module.exports = new LogService();
