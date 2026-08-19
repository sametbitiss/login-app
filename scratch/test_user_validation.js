const { validateUserCreate, validateUserUpdate } = require('../src/validations/userValidation');

console.log('Testing User Validation Logic...');

// 1. Phone Validation Test
const testPhone1 = validateUserCreate({ body: { username: 'testuser', password: 'password123', email: 'test@example.com', phone: '0555abc1234' } });
console.log('Test Invalid Phone (letters):', !testPhone1.valid, testPhone1.errors);

const testPhone2 = validateUserCreate({ body: { username: 'testuser', password: 'password123', email: 'test@example.com', phone: '123' } });
console.log('Test Invalid Phone (too short):', !testPhone2.valid, testPhone2.errors);

const testPhoneValid = validateUserCreate({ body: { username: 'testuser', password: 'password123', email: 'test@example.com', phone: '+90 (555) 123 45 67' } });
console.log('Test Valid Phone:', testPhoneValid.valid);

// 2. Email Validation Test
const testEmail1 = validateUserCreate({ body: { username: 'testuser', password: 'password123', email: 'invalid-email', phone: '+905551234567' } });
console.log('Test Invalid Email:', !testEmail1.valid, testEmail1.errors);

// 3. Password Validation Test
const testPass1 = validateUserCreate({ body: { username: 'testuser', password: '123', email: 'test@example.com' } });
console.log('Test Short Password:', !testPass1.valid, testPass1.errors);

// 4. Name Validation Test
const testName1 = validateUserCreate({ body: { username: 'testuser', password: 'password123', email: 'test@example.com', firstName: 'Ahmet123' } });
console.log('Test Invalid Name (digits):', !testName1.valid, testName1.errors);

console.log('Validation Unit Tests Completed.');
