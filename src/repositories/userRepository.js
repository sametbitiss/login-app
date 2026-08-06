const { User, SystemSetting } = require('../../models');
const logService = require('../services/logService');
const bcrypt = require('bcrypt');

class UserRepository {
  async findByUsername(username) {
    return await User.findOne({ where: { username } });
  }

  async findAll() {
    return await User.findAll({
      attributes: ['id', 'username', 'email', 'firstName', 'lastName', 'phone', 'department', 'title', 'role', 'status', 'createdAt', 'updatedAt'],
      order: [['id', 'ASC']]
    });
  }

  async findById(id) {
    return await User.findByPk(id);
  }

  async create(userData, currentUser = null, ipAddress = null) {
    const newUser = await User.create(userData);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : newUser.id,
      username: currentUser ? currentUser.username : newUser.username,
      action: 'CREATE',
      entity: 'User',
      entityId: newUser.id,
      details: { username: newUser.username, email: newUser.email, role: newUser.role, department: newUser.department, status: newUser.status },
      ipAddress
    });

    return newUser;
  }

  async updateUser(id, updateData, currentUser = null, ipAddress = null) {
    const user = await User.findByPk(id);
    if (!user) return null;

    const oldData = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      department: user.department,
      title: user.title,
      role: user.role,
      status: user.status
    };

    await user.update(updateData);

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'User',
      entityId: user.id,
      details: { oldData, newData: updateData },
      ipAddress
    });

    return user;
  }

  async updateRole(id, newRole, currentUser = null, ipAddress = null) {
    const user = await User.findByPk(id);
    if (!user) return null;

    const oldRole = user.role;
    user.role = newRole;
    await user.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'User',
      entityId: user.id,
      details: { field: 'role', oldRole, newRole },
      ipAddress
    });

    return user;
  }

  async toggleStatus(id, newStatus, currentUser = null, ipAddress = null) {
    const user = await User.findByPk(id);
    if (!user) return null;

    const oldStatus = user.status;
    user.status = newStatus;
    await user.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'User',
      entityId: user.id,
      details: { field: 'status', oldStatus, newStatus },
      ipAddress
    });

    return user;
  }

  async resetPassword(id, rawPassword, currentUser = null, ipAddress = null) {
    const user = await User.findByPk(id);
    if (!user) return null;

    const hashedPassword = await bcrypt.hash(rawPassword, 10);
    user.password = hashedPassword;
    await user.save();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'User',
      entityId: user.id,
      details: { action: 'Password Reset' },
      ipAddress
    });

    return user;
  }

  async deleteUser(id, currentUser = null, ipAddress = null) {
    const user = await User.findByPk(id);
    if (!user) return false;

    const deletedUsername = user.username;
    await user.destroy();

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'DELETE',
      entity: 'User',
      entityId: id,
      details: { username: deletedUsername },
      ipAddress
    });

    return true;
  }

  // --- SYSTEM SETTINGS ---
  async getAllSettings() {
    return await SystemSetting.findAll({ order: [['category', 'ASC'], ['key', 'ASC']] });
  }

  async updateSettings(settingsData, currentUser = null, ipAddress = null) {
    for (const [key, value] of Object.entries(settingsData)) {
      const setting = await SystemSetting.findOne({ where: { key } });
      if (setting) {
        setting.value = String(value);
        await setting.save();
      }
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'SystemSetting',
      entityId: 'All',
      details: settingsData,
      ipAddress
    });
  }

  async getPermissionMatrix() {
    const { DEFAULT_ROLE_MATRIX } = require('../config/permissionMatrix');
    const setting = await SystemSetting.findOne({ where: { key: 'role_permission_matrix' } });
    if (setting && setting.value) {
      try {
        return JSON.parse(setting.value);
      } catch (e) {}
    }
    return DEFAULT_ROLE_MATRIX;
  }

  async savePermissionMatrix(matrix, currentUser = null, ipAddress = null) {
    let setting = await SystemSetting.findOne({ where: { key: 'role_permission_matrix' } });
    const val = JSON.stringify(matrix);
    if (setting) {
      setting.value = val;
      await setting.save();
    } else {
      await SystemSetting.create({
        key: 'role_permission_matrix',
        value: val,
        description: 'Rol ve yetki matrisi tanımı',
        category: 'Security'
      });
    }

    await logService.logCrud({
      userId: currentUser ? currentUser.id : null,
      username: currentUser ? currentUser.username : 'System',
      action: 'UPDATE',
      entity: 'SystemSetting',
      entityId: 'role_permission_matrix',
      details: { action: 'Updated Role Permission Matrix' },
      ipAddress
    });
  }
}

module.exports = new UserRepository();
