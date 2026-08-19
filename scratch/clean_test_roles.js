const { SistemAyari } = require('../models');

async function cleanTestRoles() {
  console.log('Cleaning test custom roles...');
  await SistemAyari.destroy({ where: { anahtar: 'custom_roles_list' } });
  await SistemAyari.destroy({ where: { anahtar: 'role_permission_matrix' } });
  console.log('Cleaned custom roles and permission matrix settings.');
  process.exit(0);
}

cleanTestRoles();
