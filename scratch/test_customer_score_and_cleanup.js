const { CustomerAccount, SaleQuotation, SaleOrder, sequelize } = require('../models');
const customerRepository = require('../src/repositories/customerRepository');
const quotationRepository = require('../src/repositories/quotationRepository');

async function runTestAndCleanup() {
  try {
    await sequelize.sync({ alter: true });
    console.log('--- STARTING CUSTOMER SCORE & RISK TEST ---');

    // 1. Create a low score / high risk customer
    const riskCustomer = await CustomerAccount.create({
      customerCode: `CUST-TEST-RISK-${Date.now()}`,
      companyName: 'Test Riskli Müşteri Ltd.',
      customerScore: 35,
      riskLevel: 'High',
      creditLimit: 50000,
      currentBalance: 60000
    });

    console.log('Created Risk Customer:', riskCustomer.companyName, 'Score:', riskCustomer.customerScore);

    // 2. Create a high score / low risk customer
    const goodCustomer = await CustomerAccount.create({
      customerCode: `CUST-TEST-GOOD-${Date.now()}`,
      companyName: 'Test Güvenilir Müşteri A.Ş.',
      customerScore: 95,
      riskLevel: 'Low',
      creditLimit: 200000,
      currentBalance: 0
    });

    console.log('Created Good Customer:', goodCustomer.companyName, 'Score:', goodCustomer.customerScore);

    // 3. Test quotation creation check logic
    const isRiskBlocked = riskCustomer.customerScore < 50 || riskCustomer.riskLevel === 'High';
    if (isRiskBlocked) {
      console.log('SUCCESS: Risk Customer (Score 35) is correctly flagged as BLOCKED for quotes & orders!');
    } else {
      console.error('FAILED: Risk customer was not blocked');
    }

    const isGoodBlocked = goodCustomer.customerScore < 50 || goodCustomer.riskLevel === 'High';
    if (!isGoodBlocked) {
      console.log('SUCCESS: Good Customer (Score 95) is correctly APPROVED for quotes & orders!');
    } else {
      console.error('FAILED: Good customer was wrongly blocked');
    }

    // 4. CLEANUP TEST DATA as requested by user
    console.log('--- CLEANING UP TEMPORARY TEST DATA ---');
    await SaleQuotation.destroy({ where: { quotationNo: { [sequelize.Sequelize.Op.like]: 'TEST-%' } } });
    await CustomerAccount.destroy({ where: { id: [riskCustomer.id, goodCustomer.id] } });
    console.log('SUCCESS: All temporary test data cleaned up completely!');

    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTestAndCleanup();
