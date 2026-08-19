const { isValidEmail } = require('../src/validations/userValidation');

const testEmails = [
  'jdsjsfd@',
  'jdsjsfd@com',
  'jdsjsfd@domain',
  'jdsjsfd@domain.',
  'jdsjsfd@domain.c',
  'test@.com',
  'test@domain..com',
  'test@domain.com',
  'ahmet.yilmaz@enterprise-erp.com',
  'user.name+tag@sub.domain.co.tr'
];

console.log('Testing Strict Email Validation Cases:');
testEmails.forEach(e => {
  console.log(`  "${e}" -> ${isValidEmail(e) ? 'VALID ✅' : 'INVALID ❌'}`);
});
