const { SystemSetting } = require('../../models');

/**
 * Maintenance Mode Middleware
 * Checks if 'maintenance_mode' system setting is enabled ('true').
 * If enabled, blocks non-Admin users and displays maintenance page.
 */
const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip static assets, login/logout pages
    const path = req.path || '';
    if (path.startsWith('/login') || path.startsWith('/logout') || path.includes('.')) {
      return next();
    }

    const maintenanceSetting = await SystemSetting.findOne({ where: { key: 'maintenance_mode' } });
    const isMaintenance = maintenanceSetting && maintenanceSetting.value === 'true';

    if (isMaintenance) {
      // If user is Admin, allow full access
      if (req.user && req.user.role === 'Admin') {
        return next();
      }

      // If user is not Admin or not logged in, render maintenance page
      return res.status(503).render('maintenance');
    }

    next();
  } catch (err) {
    // Fallthrough to next middleware if error reading setting
    next();
  }
};

module.exports = checkMaintenanceMode;
