const { AuditLog, User } = require('../../models');
const logger = require('../utils/logger');
const { Op } = require('sequelize');

class LogService {
  async logCrud({ userId, username, action, entity, entityId, details, ipAddress }) {
    const detailsStr = typeof details === 'object' ? JSON.stringify(details) : String(details || '');

    logger.crud(`${action} on ${entity} (ID: ${entityId || 'N/A'}) by user ${username || userId || 'System'}`, {
      entity,
      entityId,
      details,
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

  async getRecentLogs(limit = 100, filters = {}) {
    const where = {};

    if (filters.action && ['CREATE', 'READ', 'UPDATE', 'DELETE'].includes(filters.action)) {
      where.action = filters.action;
    }

    if (filters.entity) {
      where.entity = { [Op.iLike || Op.like]: `%${filters.entity}%` };
    }

    return await AuditLog.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      include: [{ model: User, as: 'user', attributes: ['id', 'username', 'email'] }]
    });
  }
}

module.exports = new LogService();
