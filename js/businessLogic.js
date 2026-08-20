(function () {
  const cryptoLib = (() => {
    try {
      return require('node:crypto');
    } catch (error) {
      return null;
    }
  })();

  function hashText(value) {
    const raw = String(value ?? '').trim();
    if (!raw) return '';

    if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
      return window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)).then((buffer) => {
        return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      });
    }

    if (cryptoLib) {
      return cryptoLib.createHash('sha256').update(raw).digest('hex');
    }

    return raw;
  }

  function verifyHash(value, expectedHash) {
    if (!value || !expectedHash) return false;
    const candidate = hashText(value);
    if (typeof candidate === 'string') {
      return candidate === expectedHash;
    }
    return candidate.then((hash) => hash === expectedHash);
  }

  const ROLE_DEFINITIONS = {
    owner: {
      id: 'owner',
      name: 'المالك',
      level: 1,
      permissions: [
        'manage_roles',
        'manage_products',
        'manage_discounts',
        'manage_finance',
        'manage_cms',
        'accept_orders'
      ]
    },
    general_manager: {
      id: 'general_manager',
      name: 'مدير عام',
      level: 2,
      permissions: [
        'manage_products',
        'manage_discounts',
        'manage_finance',
        'manage_cms',
        'view_reports'
      ]
    },
    customer_service: {
      id: 'customer_service',
      name: 'خدمة عملاء',
      level: 3,
      permissions: [
        'manage_customers',
        'quick_discount',
        'view_orders'
      ]
    },
    data_entry: {
      id: 'data_entry',
      name: 'مدخل بيانات',
      level: 4,
      permissions: [
        'add_products',
        'update_product_data',
        'view_inventory'
      ]
    }
  };

  const ROLE_ORDER = ['owner', 'general_manager', 'customer_service', 'data_entry'];
  const PERMISSION_ROWS = [
    { key: 'orders', label: 'الطلبات' },
    { key: 'products', label: 'المنتجات' },
    { key: 'content', label: 'محتوى الموقع' },
    { key: 'finance', label: 'الماليات' },
    { key: 'employees', label: 'الموظفين' },
    { key: 'settings', label: 'الإعدادات' }
  ];

  function buildPermissionMatrix() {
    return {
      orders: { view: false, add: false, edit: false, delete: false },
      products: { view: false, add: false, edit: false, delete: false },
      content: { view: false, add: false, edit: false, delete: false },
      finance: { view: false, add: false, edit: false, delete: false },
      employees: { view: false, add: false, edit: false, delete: false },
      settings: { view: false, add: false, edit: false, delete: false },
      quickDiscount: false,
      updateBostaKeys: false
    };
  }

  function normalizeEmployeePermissions(rawPermissions = {}) {
    const matrix = buildPermissionMatrix();
    const source = rawPermissions || {};

    Object.keys(matrix).forEach((key) => {
      if (typeof matrix[key] === 'object' && matrix[key] !== null) {
        Object.keys(matrix[key]).forEach((action) => {
          matrix[key][action] = Boolean(source[key] && source[key][action]);
        });
      } else {
        matrix[key] = Boolean(source[key]);
      }
    });

    return matrix;
  }

  function canEmployeeAccess(employee, section, action) {
    if (!employee) return false;
    if (employee.role === 'owner') return true;
    const permissions = normalizeEmployeePermissions(employee.permissions || {});
    if (section === 'quickDiscount') return Boolean(permissions.quickDiscount);
    if (section === 'updateBostaKeys') return Boolean(permissions.updateBostaKeys);
    if (!permissions[section]) return false;
    if (typeof permissions[section] === 'boolean') return permissions[section];
    return Boolean(permissions[section][action]);
  }

  function can(role, permission) {
    const normalizedRole = (role || '').toString();
    if (normalizedRole === 'owner') return true;
    const roleConfig = ROLE_DEFINITIONS[normalizedRole];
    if (!roleConfig) return false;
    return roleConfig.permissions.includes(permission);
  }

  function isFinanceSectionVisible(role, financeVisible) {
    if (!role) return false;
    if (role === 'owner') return true; // Owner always sees finance
    if (role === 'general_manager') {
      return Boolean(financeVisible);
    }
    return false;
  }

  function processPromoCode({ code, amount, type = 'percentage', value, userRole }) {
    const normalizedCode = (code || '').toString().trim().toUpperCase();
    const numericAmount = Number(amount);
    const numericValue = Number(value);

    if (!normalizedCode) {
      return { valid: false, reason: 'EMPTY_CODE', finalAmount: numericAmount || 0, discountValue: 0 };
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { valid: false, reason: 'INVALID_AMOUNT', finalAmount: 0, discountValue: 0 };
    }

    if (!['owner', 'general_manager'].includes(userRole)) {
      return { valid: false, reason: 'ROLE_FORBIDDEN', finalAmount: numericAmount, discountValue: 0 };
    }

    let discountValue = 0;

    if (type === 'percentage') {
      discountValue = numericAmount * (numericValue / 100);
    } else {
      discountValue = Number.isFinite(numericValue) ? numericValue : 0;
    }

    const finalAmount = Math.max(numericAmount - discountValue, 0);

    return {
      valid: true,
      code: normalizedCode,
      type,
      discountValue,
      finalAmount,
      originalAmount: numericAmount
    };
  }

  function applyCustomerServiceDiscount({ orderTotal, discountAmount, userRole }) {
    const numericTotal = Number(orderTotal);
    const numericDiscount = Number(discountAmount);

    if (userRole !== 'customer_service') {
      return { allowed: false, reason: 'ROLE_FORBIDDEN', finalTotal: numericTotal || 0, discountApplied: 0 };
    }

    if (!Number.isFinite(numericTotal) || numericTotal <= 0) {
      return { allowed: false, reason: 'INVALID_TOTAL', finalTotal: 0, discountApplied: 0 };
    }

    if (!Number.isFinite(numericDiscount) || numericDiscount <= 0) {
      return { allowed: false, reason: 'INVALID_DISCOUNT', finalTotal: numericTotal, discountApplied: 0 };
    }

    if (numericDiscount > 50) {
      return { allowed: false, reason: 'MAX_DISCOUNT_EXCEEDED', finalTotal: numericTotal, discountApplied: 0 };
    }

    return {
      allowed: true,
      finalTotal: Math.max(numericTotal - numericDiscount, 0),
      discountApplied: numericDiscount,
      reason: null
    };
  }

  function validateProductWeight(weight) {
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericWeight)) return false;
    return numericWeight > 0 && numericWeight <= 100;
  }

  function getBostaSizes() {
    return [
      'حجم صغير ومتوسط',
      'حجم كبير L',
      'حجم أكبر XL',
      'كيس أبيض XXL',
      'شحنة كبيرة',
      'شحنة ضخمة'
    ];
  }

  function normalizeReview(review = {}) {
    return {
      id: review.id || `rev_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      name: review.name || 'عميل',
      city: review.city || 'القاهرة',
      text: review.text || '',
      rating: Math.min(Math.max(Number(review.rating) || 5, 1), 5),
      verified: Boolean(review.verified !== false),
      createdAt: review.createdAt || new Date().toISOString()
    };
  }

  function createDefaultAdminState() {
    const fullMatrix = buildPermissionMatrix();
    Object.keys(fullMatrix).forEach((key) => {
      if (typeof fullMatrix[key] === 'object' && fullMatrix[key] !== null) {
        Object.keys(fullMatrix[key]).forEach((action) => {
          fullMatrix[key][action] = true;
        });
      } else {
        fullMatrix[key] = true;
      }
    });

    return {
      currentRole: 'owner',
      financeVisible: true,
      roles: ['owner', 'general_manager', 'customer_service', 'data_entry'],
      managers: [
        { id: 'manager_default', name: 'أحمد', role: 'general_manager' }
      ],
      platform: {
        brandName: 'أولاد القاضي',
        logo: '../assets/logo.jpg',
        sidebar: [
          { id: 'hero', label: 'الواجهة الرئيسية', visible: true },
          { id: 'announcement', label: 'شريط الإعلانات', visible: true },
          { id: 'roles', label: 'الصلاحيات والخصومات', visible: true },
          { id: 'cms', label: 'إدارة المحتوى', visible: true },
          { id: 'products', label: 'المنتجات والأقسام', visible: true },
          { id: 'contact', label: 'بيانات التواصل', visible: true },
          { id: 'reviews', label: 'آراء العملاء', visible: true }
        ]
      },
      employees: [
        {
          id: 'emp_owner',
          name: 'المالك',
          role: 'owner',
          permissions: fullMatrix
        }
      ],
      promoCodes: [],
      discounts: {
        promoCodes: []
      },
      bostaSizes: getBostaSizes(),
      products: [],
      cms: {
        footerText: 'جميع الحقوق محفوظة © 2026 أولاد القاضي',
        footerEmail: 'hello@awladelkady.com',
        footerPhone: '01118060702'
      },
      reviews: []
    };
  }

  const DEFAULT_AUTH_CREDENTIALS = {
    managerPasswordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    employeePhoneHash: 'e60124f2fe2045215abda1ae912aa80bb66dab5fc231a758387682c9c0e70c01',
    ownerPinHash: 'e452428d42ebcb70f864ec851c90f61084729452322491eda7f5ae6c059afc86'
  };

  const api = {
    ROLE_DEFINITIONS,
    ROLE_ORDER,
    PERMISSION_ROWS,
    buildPermissionMatrix,
    normalizeEmployeePermissions,
    canEmployeeAccess,
    can,
    isFinanceSectionVisible,
    processPromoCode,
    applyCustomerServiceDiscount,
    validateProductWeight,
    getBostaSizes,
    normalizeReview,
    createDefaultAdminState,
    hashText,
    verifyHash,
    DEFAULT_AUTH_CREDENTIALS,
    verifyManagerPassword: (password) => verifyHash(password, DEFAULT_AUTH_CREDENTIALS.managerPasswordHash),
    verifyEmployeePhone: (phone) => verifyHash(phone, DEFAULT_AUTH_CREDENTIALS.employeePhoneHash),
    verifyOwnerPin: (pin) => verifyHash(pin, DEFAULT_AUTH_CREDENTIALS.ownerPinHash)
  };

  if (typeof window !== 'undefined') {
    window.AdminBusinessLogic = api;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})();
