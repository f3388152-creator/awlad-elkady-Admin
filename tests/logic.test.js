const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ROLE_DEFINITIONS,
  can,
  isFinanceSectionVisible,
  processPromoCode,
  applyCustomerServiceDiscount,
  validateProductWeight,
  createDefaultAdminState,
  verifyManagerPassword,
  verifyEmployeePhone,
  verifyOwnerPin
} = require('../js/businessLogic.js');

test('roles are defined with expected hierarchy and permissions', () => {
  assert.equal(ROLE_DEFINITIONS.owner.name, 'المالك');
  assert.equal(ROLE_DEFINITIONS.general_manager.name, 'مدير عام');
  assert.equal(ROLE_DEFINITIONS.customer_service.name, 'خدمة عملاء');
  assert.equal(ROLE_DEFINITIONS.data_entry.name, 'مدخل بيانات');

  assert.ok(can('owner', 'manage_products'));
  assert.ok(can('general_manager', 'manage_discounts'));
  assert.ok(can('customer_service', 'quick_discount'));
  assert.ok(!can('data_entry', 'manage_discounts'));
});

test('finance visibility is controlled by owner and role config', () => {
  assert.equal(isFinanceSectionVisible('owner', true), true);
  assert.equal(isFinanceSectionVisible('owner', false), false);
  assert.equal(isFinanceSectionVisible('general_manager', true), true);
  assert.equal(isFinanceSectionVisible('customer_service', true), false);
});

test('promo codes are validated and applied once', () => {
  const promo = processPromoCode({
    code: 'SALE10',
    amount: 1000,
    type: 'percentage',
    value: 10,
    userRole: 'owner'
  });

  assert.equal(promo.valid, true);
  assert.equal(promo.finalAmount, 900);
  assert.equal(promo.discountValue, 100);
});

test('customer service can apply a limited persuasive discount', () => {
  const result = applyCustomerServiceDiscount({
    orderTotal: 800,
    discountAmount: 40,
    userRole: 'customer_service'
  });

  assert.equal(result.allowed, true);
  assert.equal(result.finalTotal, 760);
  assert.equal(result.discountApplied, 40);

  const blocked = applyCustomerServiceDiscount({
    orderTotal: 400,
    discountAmount: 90,
    userRole: 'customer_service'
  });

  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'MAX_DISCOUNT_EXCEEDED');
});

test('product weight validation and default state are consistent', () => {
  const state = createDefaultAdminState();
  assert.equal(state.products[0].approxWeightKg, 2.4);
  assert.equal(validateProductWeight(0.5), true);
  assert.equal(validateProductWeight(-2), false);
});

test('hashed local auth matches manager, employee and owner secrets', () => {
  assert.equal(verifyManagerPassword('admin123'), true);
  assert.equal(verifyEmployeePhone('01012345678'), true);
  assert.equal(verifyOwnerPin('500900'), true);
  assert.equal(verifyManagerPassword('wrongpass'), false);
});
