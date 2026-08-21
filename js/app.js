(function () {
  const BOOTSTRAP = window.ADMIN_BOOTSTRAP || {};
  const API_BASE = BOOTSTRAP.apiBase || '/api';
  const OWNER_PIN = String(BOOTSTRAP.ownerPin || '500900');
  const ROLE_LABELS = {
    super_admin: 'المالك',
    owner: 'المالك',
    manager: 'مدير',
    employee: 'موظف'
  };

  const PRODUCT_WEIGHT_OPTIONS = [
    { value: 'small_medium', label: 'صغير/متوسط' },
    { value: 'l', label: 'L' },
    { value: 'xl', label: 'XL' },
    { value: 'xxl', label: 'XXL' },
    { value: 'large', label: 'كبيرة' },
    { value: 'huge', label: 'ضخمة' }
  ];

  const SHIPPING_FEE_FIELD_BY_WEIGHT = {
    small_medium: 'size_small_medium',
    l: 'size_l',
    xl: 'size_xl',
    xxl: 'size_xxl',
    large: 'size_large',
    huge: 'size_huge'
  };

  const SECTION_META = {
    dashboard: { title: 'الداشبورد', eyebrow: 'Dashboard' },
    products: { title: 'المنتجات', eyebrow: 'Products' },
    orders: { title: 'الأوردرات', eyebrow: 'Orders' },
    finance: { title: 'الماليات', eyebrow: 'Finance' },
    cms: { title: 'إدارة المحتوى', eyebrow: 'CMS' },
    employees: { title: 'الموظفين والصلاحيات', eyebrow: 'Employees' },
    security: { title: 'طلبات الأمان', eyebrow: 'Security' }
  };

  const PERMISSIONS = {
    super_admin: { all: true, security: true, cms: true, finance: true, orders: true, products: true, employees: true },
    manager: { all: false, security: false, cms: true, finance: true, orders: true, products: true, employees: true },
    employee: { all: false, security: false, cms: false, finance: false, orders: true, products: false, employees: false }
  };

  const state = {
    config: null,
    client: null,
    session: null,
    activeSection: 'dashboard',
    data: {
      products: [],
      orders: [],
      employees: [],
      site_settings: [],
      security_requests: [],
      returns: [],
      operating_expenses: [],
      shipping_rates: []
    },
    ui: {
      loading: false,
      sidebarOpen: false,
      authMode: 'manager',
      pinVisible: false,
      editingProductId: null,
      editingEmployeeId: null,
      filters: {
        products: '',
        orders: '',
        employees: ''
      }
    }
  };

  const refs = {};

  const nf = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
  const df = new Intl.DateTimeFormat('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });

  document.addEventListener('DOMContentLoaded', init);

  function cacheRefs() {
    refs.authScreen = document.getElementById('authScreen');
    refs.appShell = document.getElementById('appShell');
    refs.connectionStatus = document.getElementById('connectionStatus');
    refs.roleChip = document.getElementById('roleChip');
    refs.sessionText = document.getElementById('sessionText');
    refs.sectionTitle = document.getElementById('sectionTitle');
    refs.sectionEyebrow = document.getElementById('sectionEyebrow');
    refs.sidebar = document.getElementById('sidebar');
    refs.sidebarNav = document.getElementById('sidebarNav');
    refs.appBackdrop = document.getElementById('appBackdrop');
    refs.pinModal = document.getElementById('pinModal');
    refs.pinForm = document.getElementById('pinForm');
    refs.pinInput = document.getElementById('pinInput');
    refs.toastStack = document.getElementById('toastStack');
    refs.dashboardRoot = document.getElementById('dashboardRoot');
    refs.productsRoot = document.getElementById('productsRoot');
    refs.ordersRoot = document.getElementById('ordersRoot');
    refs.financeRoot = document.getElementById('financeRoot');
    refs.cmsRoot = document.getElementById('cmsRoot');
    refs.employeesRoot = document.getElementById('employeesRoot');
    refs.securityRoot = document.getElementById('securityRoot');
  }

  async function init() {
    cacheRefs();
    bindStaticEvents();
    applyAuthMode('manager');
    await loadConfig();
    state.client = AdminSupabaseAPI.createClient({
      supabaseUrl: state.config?.supabaseUrl || '',
      supabaseKey: state.config?.supabaseAnonKey || '',
      storageBucket: state.config?.supabaseStorageBucket || BOOTSTRAP.storageBucket || 'admin-media'
    });

    restoreSession();
    if (state.session) {
      enterApp();
      await refreshAll();
    } else {
      showAuth();
      setConnectionStatus(state.client ? 'جاهز' : 'مفيش اتصال بقاعدة البيانات');
    }
  }

  function bindStaticEvents() {
    document.addEventListener('submit', (event) => {
      event.preventDefault();
    }, true);
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('input', handleInput);
    document.addEventListener('change', handleChange);
    document.addEventListener('keydown', handleKeydown);
  }

  async function loadConfig() {
    const fallback = {
      supabaseUrl: '',
      supabaseAnonKey: '',
      supabaseStorageBucket: BOOTSTRAP.storageBucket || 'admin-media'
    };

    try {
      const response = await fetch(`${API_BASE}/config`);
      const payload = await response.json();
      state.config = {
        ...fallback,
        ...payload
      };
    } catch (error) {
      state.config = fallback;
      console.warn('Config load failed, using bootstrap fallback', error);
    }
  }

  function restoreSession() {
    try {
      const raw = sessionStorage.getItem('awlad_admin_session');
      state.session = raw ? JSON.parse(raw) : null;
    } catch {
      state.session = null;
    }
  }

  function persistSession() {
    if (!state.session) {
      sessionStorage.removeItem('awlad_admin_session');
      return;
    }
    sessionStorage.setItem('awlad_admin_session', JSON.stringify(state.session));
  }

  function setSession(session) {
    state.session = session;
    persistSession();
    renderSessionBadge();
  }

  function clearSession() {
    state.session = null;
    persistSession();
  }

  function showAuth() {
    refs.authScreen.classList.remove('hidden');
    refs.appShell.classList.add('hidden');
  }

  function enterApp() {
    refs.authScreen.classList.add('hidden');
    refs.appShell.classList.remove('hidden');
    renderSessionBadge();
    applyRoleVisibility();
    renderActiveSection();
    setSidebar(false);
  }

  function setConnectionStatus(text, tone = '') {
    if (!refs.connectionStatus) return;
    refs.connectionStatus.textContent = text;
    refs.connectionStatus.className = `status-pill ${tone}`.trim();
  }

  function renderSessionBadge() {
    if (!state.session) {
      refs.roleChip.textContent = 'غير مسجل';
      refs.sessionText.textContent = 'سجل دخولك عشان تبدأ.';
      return;
    }

    const label = ROLE_LABELS[state.session.role] || state.session.role || 'مستخدم';
    refs.roleChip.textContent = label;
    refs.sessionText.textContent = state.session.name ? `أهلاً ${state.session.name}` : 'تم تسجيل الدخول.';
    refs.roleChip.style.background = state.session.role === 'super_admin'
      ? 'rgba(134, 169, 140, 0.22)'
      : 'rgba(32, 50, 74, 0.08)';
    refs.roleChip.style.color = state.session.role === 'super_admin' ? 'var(--sage-dark)' : 'var(--navy-soft)';
  }

  function applyAuthMode(mode) {
    state.ui.authMode = mode;
    document.querySelectorAll('[data-login-mode]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.loginMode === mode);
    });
    document.querySelectorAll('[data-login-form]').forEach((form) => {
      form.classList.toggle('active', form.dataset.loginForm === mode);
    });
  }

  function applyRoleVisibility() {
    const isOwner = isSuperAdmin();
    document.querySelectorAll('.owner-only').forEach((el) => {
      el.classList.toggle('hidden', !isOwner);
    });
    document.querySelectorAll('.owner-only-panel').forEach((el) => {
      el.classList.toggle('hidden', !isOwner);
    });
  }

  function isSuperAdmin() {
    return Boolean(state.session && state.session.role === 'super_admin');
  }

  function canAccess(section) {
    if (isSuperAdmin()) return true;
    const role = state.session?.role || 'employee';
    const map = PERMISSIONS[role] || PERMISSIONS.employee;
    return Boolean(map.all || map[section]);
  }

  function handleClick(event) {
    const loginModeBtn = event.target.closest('[data-login-mode]');
    if (loginModeBtn) {
      applyAuthMode(loginModeBtn.dataset.loginMode);
      return;
    }

    const navItem = event.target.closest('[data-section]');
    if (navItem && navItem.closest('#sidebarNav')) {
      setSection(navItem.dataset.section);
      return;
    }

    const action = event.target.closest('[data-action]');
    if (action) {
      const { action: actionName, id, type } = action.dataset;
      if (actionName === 'logout') {
        handleLogout();
      } else if (actionName === 'sync') {
        refreshAll();
      } else if (actionName === 'open-sidebar') {
        setSidebar(true);
      } else if (actionName === 'close-sidebar') {
        setSidebar(false);
      } else if (actionName === 'edit-product') {
        startEditProduct(id);
      } else if (actionName === 'delete-product') {
        deleteProduct(id);
      } else if (actionName === 'edit-employee') {
        startEditEmployee(id);
      } else if (actionName === 'delete-employee') {
        deleteEmployee(id);
      } else if (actionName === 'approve-request') {
        updateSecurityRequest(id, 'approved');
      } else if (actionName === 'reject-request') {
        updateSecurityRequest(id, 'rejected');
      } else if (actionName === 'new-request') {
        openSecurityRequestDraft();
      } else if (actionName === 'close-pin') {
        closePinModal();
      } else if (actionName === 'save-draft') {
        saveDraftFromCard(type);
      } else if (actionName === 'cancel-product-edit') {
        state.ui.editingProductId = null;
        renderProducts();
      } else if (actionName === 'cancel-employee-edit') {
        state.ui.editingEmployeeId = null;
        renderEmployees();
      }
    }

    const sectionSwitch = event.target.closest('[data-panel-switch]');
    if (sectionSwitch) {
      setSection(sectionSwitch.dataset.panelSwitch);
    }

    if (event.target === refs.appBackdrop) {
      setSidebar(false);
    }

    if (event.target === document.getElementById('closeSidebarBtn')) {
      setSidebar(false);
    }

    if (event.target === document.getElementById('openSidebarBtn')) {
      setSidebar(true);
    }

    if (event.target === document.getElementById('syncBtn')) {
      refreshAll();
    }

    if (event.target === document.getElementById('logoutBtn')) {
      handleLogout();
    }

    if (event.target === document.getElementById('closePinModalBtn')) {
      closePinModal();
    }
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') {
      closePinModal();
      setSidebar(false);
    }
  }

  function handleInput(event) {
    const el = event.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
    const value = String(el.value || '');
    if (value.includes('@@')) {
      el.value = value.replace(/@@/g, '');
      openPinModal();
    }

    const target = el.getAttribute('data-search-target');
    if (target && state.ui.filters[target] !== undefined) {
      state.ui.filters[target] = el.value.trim().toLowerCase();
      renderSection(state.activeSection);
    }
  }

  function handleChange(event) {
    const el = event.target;
    if (el && el.matches && el.matches('[data-permission]')) {
      return;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    event.stopPropagation();
    const form = event.target;
    const formId = form?.getAttribute?.('id') || form?.id || '';

    if (formId === 'managerLoginForm') {
      event.preventDefault();
      const password = new FormData(form).get('password')?.toString().trim();
      await handleManagerLogin(password);
      return;
    }

    if (formId === 'employeeLoginForm') {
      event.preventDefault();
      const phone = normalizePhone(new FormData(form).get('phone')?.toString());
      await handleEmployeeLogin(phone);
      return;
    }

    if (formId === 'pinForm') {
      event.preventDefault();
      const pin = refs.pinInput.value.trim();
      handleOwnerPin(pin);
      return;
    }

    if (formId === 'productForm') {
      event.preventDefault();
      await handleProductSave(form);
      return;
    }

    if (formId === 'orderForm') {
      event.preventDefault();
      await handleOrderCreate(form);
      return;
    }

    if (formId === 'expenseForm') {
      event.preventDefault();
      await handleExpenseSave(form);
      return;
    }

    if (formId === 'returnForm') {
      event.preventDefault();
      await handleReturnSave(form);
      return;
    }

    if (formId === 'cmsForm') {
      event.preventDefault();
      await handleCmsSave(form);
      return;
    }

    if (formId === 'employeeForm') {
      event.preventDefault();
      await handleEmployeeSave(form);
      return;
    }

    if (formId === 'securityRequestForm') {
      event.preventDefault();
      await handleSecurityRequestSubmit(form);
    }
  }

  async function handleManagerLogin(password) {
    if (!state.client) return toast('مفيش اتصال بقاعدة البيانات', 'error');
    if (!password) return toast('اكتب كلمة السر الأول', 'error');

    try {
      const rows = await state.client.select('employees', {
        filters: ['role=in.(manager,admin,super_admin)']
      });
      const hashedPassword = await hashText(password);
      const match = (rows || []).find((row) => String(row.password_hash || '').trim() === hashedPassword);
      if (!match) {
        toast('كلمة السر غير صحيحة', 'error');
        return;
      }

      setSession({
        id: match.id,
        name: match.name || match.full_name || 'مدير',
        phone: match.phone || '',
        role: normalizeRole(match.role, 'manager'),
        permissions: normalizePermissions(match.permissions, 'manager'),
        authenticatedAt: new Date().toISOString()
      });

      enterApp();
      await refreshAll();
      toast('تم دخول المدير بنجاح', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleEmployeeLogin(phone) {
    if (!state.client) return toast('مفيش اتصال بقاعدة البيانات', 'error');
    if (!phone) return toast('اكتب رقم الموبايل الأول', 'error');

    try {
      const rows = await state.client.select('employees', {
        filters: [`phone=eq.${phone}`],
        limit: 1
      });
      const match = rows && rows[0];
      if (!match) {
        toast('رقم الموبايل غير موجود', 'error');
        return;
      }

      setSession({
        id: match.id,
        name: match.name || match.full_name || 'موظف',
        phone: match.phone || phone,
        role: normalizeRole(match.role, 'employee'),
        permissions: normalizePermissions(match.permissions, 'employee'),
        authenticatedAt: new Date().toISOString()
      });

      enterApp();
      await refreshAll();
      toast('تم دخول الموظف بنجاح', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function handleOwnerPin(pin) {
    if (String(pin).trim() !== OWNER_PIN) {
      toast('الـ PIN غير صحيح', 'error');
      return;
    }

    setSession({
      id: 'owner',
      name: 'المالك',
      phone: '',
      role: 'super_admin',
      permissions: PERMISSIONS.super_admin,
      authenticatedAt: new Date().toISOString()
    });

    closePinModal();
    enterApp();
    refreshAll();
    toast('تم فتح صلاحيات المالك', 'success');
  }

  function openPinModal() {
    state.ui.pinVisible = true;
    refs.pinModal.classList.remove('hidden');
    refs.pinModal.setAttribute('aria-hidden', 'false');
    setTimeout(() => refs.pinInput?.focus(), 80);
  }

  function closePinModal() {
    state.ui.pinVisible = false;
    refs.pinModal.classList.add('hidden');
    refs.pinModal.setAttribute('aria-hidden', 'true');
  }

  function handleLogout() {
    clearSession();
    state.activeSection = 'dashboard';
    refs.authScreen.classList.remove('hidden');
    refs.appShell.classList.add('hidden');
    toast('تم تسجيل الخروج', 'success');
  }

  function setSidebar(open) {
    state.ui.sidebarOpen = open;
    refs.sidebar.classList.toggle('open', open);
    refs.appBackdrop.classList.toggle('visible', open);
  }

  function setSection(section) {
    if (!canAccess(section)) {
      toast('الصلاحية دي مش متاحة للدور الحالي', 'error');
      return;
    }

    state.activeSection = section;
    document.querySelectorAll('.nav-item[data-section]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });
    document.querySelectorAll('.page-panel[data-panel]').forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.panel === section);
    });

    const meta = SECTION_META[section] || SECTION_META.dashboard;
    refs.sectionTitle.textContent = meta.title;
    refs.sectionEyebrow.textContent = meta.eyebrow;
    setSidebar(false);
    renderSection(section);
  }

  async function refreshAll() {
    if (!state.client) {
      setConnectionStatus('مفيش اتصال', 'danger');
      return;
    }

    try {
      state.ui.loading = true;
      setConnectionStatus('جارٍ المزامنة');

      const [products, orders, employees, siteSettings, securityRequests, returns, expenses, shippingRates] = await Promise.all([
        safeSelect('products'),
        safeSelect('orders'),
        safeSelect('employees'),
        safeSelect('site_settings'),
        safeSelect('security_requests'),
        safeSelect('returns'),
        safeSelect('operating_expenses'),
        safeSelect('shipping_rates')
      ]);

      state.data.products = normalizeProducts(products);
      state.data.orders = normalizeOrders(orders);
      state.data.employees = normalizeEmployees(employees);
      state.data.site_settings = Array.isArray(siteSettings) ? siteSettings : [];
      state.data.security_requests = normalizeSecurityRequests(securityRequests);
      state.data.returns = normalizeReturns(returns);
      state.data.operating_expenses = normalizeExpenses(expenses);
      state.data.shipping_rates = normalizeShippingRates(shippingRates);

      renderSection(state.activeSection);
      setConnectionStatus('متصل', 'success');
      toast('تمت المزامنة بنجاح', 'success');
    } catch (error) {
      console.error(error);
      setConnectionStatus('خطأ في الاتصال', 'danger');
      toast(error.message, 'error');
    } finally {
      state.ui.loading = false;
    }
  }

  async function safeSelect(table) {
    try {
      return await state.client.select(table, {});
    } catch (error) {
      console.warn(`Select failed for ${table}`, error);
      return [];
    }
  }

  function normalizeRole(role, fallback) {
    const value = String(role || fallback || 'employee').toLowerCase();
    if (value === 'super' || value === 'owner') return 'super_admin';
    if (value === 'admin') return 'manager';
    if (value === 'manager') return 'manager';
    return 'employee';
  }

  function normalizePermissions(value, role) {
    if (role === 'super_admin') return PERMISSIONS.super_admin;
    if (!value) return PERMISSIONS[role] || PERMISSIONS.employee;
    if (Array.isArray(value)) {
      return value.reduce((acc, key) => {
        acc[key] = true;
        return acc;
      }, { all: false });
    }
    if (typeof value === 'string') {
      try {
        return normalizePermissions(JSON.parse(value), role);
      } catch {
        return PERMISSIONS[role] || PERMISSIONS.employee;
      }
    }
    if (typeof value === 'object') {
      return { all: false, ...value };
    }
    return PERMISSIONS[role] || PERMISSIONS.employee;
  }

  function normalizeProducts(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id,
      title: row.title || '',
      description: row.description || '',
      price: toNumber(row.price),
      original_price: toNumber(row.original_price),
      image_url: row.image_url || '',
      stock_qty: toNumber(row.stock_qty),
      bosta_weight: row.bosta_weight || 'small_medium',
      is_visible: row.is_visible !== false
    }));
  }

  function normalizeOrders(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id,
      customer_name: row.customer_name || '',
      phone: row.phone || '',
      governorate: row.governorate || '',
      address: row.address || '',
      total_amount: toNumber(row.total_amount),
      shipping_fee: toNumber(row.shipping_fee),
      status: row.status || 'pending',
      bosta_tracking_number: row.bosta_tracking_number || ''
    }));
  }

  function normalizeEmployees(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id,
      name: row.name || '',
      phone: normalizePhone(row.phone || ''),
      role: normalizeRole(row.role, 'employee'),
      permissions: normalizePermissions(row.permissions, row.role || 'employee'),
      password_hash: row.password_hash || ''
    }));
  }

  function normalizeReturns(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id ?? row.return_id,
      order_number: row.order_number || row.reference || '',
      amount: toNumber(row.amount),
      reason: row.reason || row.notes || '',
      status: row.status || 'pending'
    }));
  }

  function normalizeExpenses(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id ?? row.expense_id,
      title: row.title || row.name || row.description || '',
      amount: toNumber(row.amount || row.value),
      category: row.category || 'تشغيل',
      note: row.note || row.notes || ''
    }));
  }

  function normalizeSecurityRequests(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id || row.request_id || '',
      name: row.name || '',
      role: row.role || 'employee',
      request_text: row.request_text || row.text || '',
      status: row.status || 'pending',
      created_at: row.created_at || row.createdAt || new Date().toISOString()
    }));
  }

  function normalizeShippingRates(rows) {
    return (rows || []).map((row) => ({
      ...row,
      id: row.id,
      zone_name: row.zone_name || '',
      governorates: row.governorates || '',
      size_small_medium: toNumber(row.size_small_medium),
      size_l: toNumber(row.size_l),
      size_xl: toNumber(row.size_xl),
      size_xxl: toNumber(row.size_xxl),
      size_large: toNumber(row.size_large),
      size_huge: toNumber(row.size_huge)
    }));
  }

  function renderWeightLabel(weight) {
    const option = PRODUCT_WEIGHT_OPTIONS.find((item) => item.value === weight);
    return option ? option.label : (weight || ' - ');
  }

  function formatWeightFees(rate) {
    return [
      `صغير/متوسط: ${formatCurrency(rate.size_small_medium)}`,
      `L: ${formatCurrency(rate.size_l)}`,
      `XL: ${formatCurrency(rate.size_xl)}`,
      `XXL: ${formatCurrency(rate.size_xxl)}`,
      `كبيرة: ${formatCurrency(rate.size_large)}`,
      `ضخمة: ${formatCurrency(rate.size_huge)}`
    ].join(' | ');
  }

  function getFeeForWeight(rate, weight) {
    const field = SHIPPING_FEE_FIELD_BY_WEIGHT[weight] || SHIPPING_FEE_FIELD_BY_WEIGHT.small_medium;
    return toNumber(rate?.[field]);
  }

  function parseGovernorates(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    const raw = String(value).trim();
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((item) => String(item).trim()).filter(Boolean)
        : [raw];
    } catch {
      return raw.split(/[,،\n]/).map((item) => String(item).trim()).filter(Boolean);
    }
  }

  function findShippingRateForGovernorate(governorate) {
    const target = String(governorate || '').trim().toLowerCase();
    if (!target) return state.data.shipping_rates[0] || null;
    return state.data.shipping_rates.find((rate) =>
      parseGovernorates(rate.governorates).some((item) => item.toLowerCase() === target)
    ) || state.data.shipping_rates[0] || null;
  }

  async function hashText(text) {
    const normalized = String(text || '');
    if (!normalized) return '';
    const bytes = new TextEncoder().encode(normalized);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }

  function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  function normalizePhone(value) {
    return String(value || '').replace(/[^\d+]/g, '').replace(/^20/, '0');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function formatCurrency(value) {
    return `${nf.format(toNumber(value))} ج.م`;
  }

  function formatDate(value) {
    if (!value) return ' - ';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return ' - ';
    return df.format(date);
  }

  function renderActiveSection() {
    renderSection(state.activeSection);
  }

  function renderSection(section) {
    switch (section) {
      case 'dashboard':
        renderDashboard();
        break;
      case 'products':
        renderProducts();
        break;
      case 'orders':
        renderOrders();
        break;
      case 'finance':
        renderFinance();
        break;
      case 'cms':
        renderCms();
        break;
      case 'employees':
        renderEmployees();
        break;
      case 'security':
        renderSecurity();
        break;
      default:
        renderDashboard();
    }
  }

  function renderDashboard() {
    const sales = state.data.orders.reduce((sum, row) => sum + toNumber(row.total_amount || row.subtotal + row.shipping_fee), 0);
    const expenses = state.data.operating_expenses.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const returnsValue = state.data.returns.reduce((sum, row) => sum + toNumber(row.amount), 0);
    const profit = sales - expenses - returnsValue;
    const newOrders = state.data.orders.filter((row) => isRecent(row.created_at, 1)).length;
    const lowStock = state.data.products.filter((row) => toNumber(row.stock) <= 5).length;

    refs.dashboardRoot.innerHTML = `
      <div class="stack">
        <div class="grid stats">
          ${statCard('المبيعات', formatCurrency(sales), `${state.data.orders.length} أوردر`, 'الرقم الحقيقي من جدول orders')}
          ${statCard('الأوردرات الجديدة', nf.format(newOrders), 'آخر 24 ساعة', 'تتحدث من created_at')}
          ${statCard('المصروفات', formatCurrency(expenses), `${state.data.operating_expenses.length} بند`, 'من operating_expenses')}
          ${statCard('صافي الربح', formatCurrency(profit), `مرتجعات: ${formatCurrency(returnsValue)}`, 'بعد خصم المرتجعات والمصروفات')}
        </div>

        <div class="grid two">
          <article class="card">
            <div class="section-toolbar">
              <div>
                <p class="eyebrow">Trend</p>
                <h3>مؤشر المبيعات الأسبوعي</h3>
              </div>
              <span class="pill">آخر 7 أيام</span>
            </div>
            ${renderTrendChart()}
          </article>

          <article class="card">
            <div class="section-toolbar">
              <div>
                <p class="eyebrow">Alerts</p>
                <h3>تنبيهات سريعة</h3>
              </div>
            </div>
            <div class="chip-list">
              <span class="chip">مخزون منخفض: ${nf.format(lowStock)}</span>
              <span class="chip">موظفين: ${nf.format(state.data.employees.length)}</span>
              <span class="chip">شحنات مسجلة: ${nf.format(state.data.shipping_rates.length)}</span>
              <span class="chip">طلبات أمان: ${nf.format(readSecurityRequests().length)}</span>
            </div>
          </article>
        </div>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Orders</p>
              <h3>آخر الأوردرات</h3>
            </div>
            <button class="mini-btn primary" type="button" data-panel-switch="orders">فتح صفحة الأوردرات</button>
          </div>
          ${renderOrdersTable(state.data.orders.slice(0, 6), true)}
        </article>
      </div>
    `;
  }

  function statCard(title, value, sub, note) {
    return `
      <article class="card stat-card">
        <div class="stat-top">
          <span class="pill">${escapeHtml(title)}</span>
          <span class="muted small">${escapeHtml(sub)}</span>
        </div>
        <p class="stat-value">${escapeHtml(value)}</p>
        <p class="stat-sub">${escapeHtml(note)}</p>
      </article>
    `;
  }

  function renderTrendChart() {
    const days = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(date);
    }

    const values = days.map((day) => {
      const start = new Date(day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(day);
      end.setHours(23, 59, 59, 999);
      return state.data.orders
        .filter((row) => {
          const created = row.created_at ? new Date(row.created_at) : null;
          return created && created >= start && created <= end;
        })
        .reduce((sum, row) => sum + toNumber(row.total_amount || row.subtotal + row.shipping_fee), 0);
    });

    const max = Math.max(...values, 1);
    return `
      <div class="chart">
        ${values.map((value, index) => {
          const height = Math.max(8, Math.round((value / max) * 100));
          return `
            <div class="chart-bar">
              <div class="chart-track">
                <div class="chart-fill" style="height:${height}%"></div>
              </div>
              <div class="chart-label">${days[index].toLocaleDateString('ar-EG', { weekday: 'short' })}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function renderProducts() {
    const editing = state.data.products.find((row) => String(row.id) === String(state.ui.editingProductId)) || null;
    const productTable = renderProductsTable(filterByQuery(state.data.products, state.ui.filters.products, ['title', 'description', 'bosta_weight']));

    refs.productsRoot.innerHTML = `
      <div class="stack">
        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Products</p>
              <h3>${editing ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
            </div>
            <span class="pill">مخزن الصور</span>
          </div>

          <form id="productForm" class="section-form" enctype="multipart/form-data">
            <input type="hidden" name="id" value="${escapeHtml(editing?.id || '')}">
            <div class="field-grid cols-3">
              <label class="field">
                <span>اسم المنتج</span>
                <input name="title" required value="${escapeHtml(editing?.title || '')}" placeholder="اسم واضح">
              </label>
              <label class="field">
                <span>السعر</span>
                <input name="price" type="number" min="0" step="1" required value="${escapeHtml(editing?.price || '')}">
              </label>
              <label class="field">
                <span>السعر قبل الخصم</span>
                <input name="original_price" type="number" min="0" step="1" value="${escapeHtml(editing?.original_price || '')}">
              </label>
            </div>

            <div class="field-grid cols-3">
              <label class="field">
                <span>المخزون</span>
                <input name="stock_qty" type="number" min="0" step="1" required value="${escapeHtml(editing?.stock_qty || '')}">
              </label>
              <label class="field">
                <span>وزن بوسطة</span>
                <select name="bosta_weight" required>
                  ${PRODUCT_WEIGHT_OPTIONS.map((option) => `<option value="${option.value}" ${String(editing?.bosta_weight || 'small_medium') === option.value ? 'selected' : ''}>${option.label}</option>`).join('')}
                </select>
              </label>
              <label class="checkbox-pill" style="align-self:end">
                <input type="checkbox" name="is_visible" ${editing?.is_visible !== false ? 'checked' : ''}>
                <span>ظاهر في الصفحة</span>
              </label>
            </div>

            <label class="field">
              <span>وصف المنتج</span>
              <textarea name="description" placeholder="وصف مختصر">${escapeHtml(editing?.description || '')}</textarea>
            </label>

            <label class="field">
              <span>الصورة</span>
              <input type="file" name="image" accept="image/*">
            </label>

            ${editing?.image_url ? `<img class="preview-image" src="${escapeHtml(editing.image_url)}" alt="صورة المنتج">` : ''}

            <div class="toolbar-actions">
              <button class="primary-btn" type="submit">${editing ? 'حفظ التعديل' : 'إضافة المنتج'}</button>
              ${editing ? `<button class="ghost-btn" type="button" data-action="cancel-product-edit">إلغاء التعديل</button>` : ''}
            </div>
          </form>
        </article>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Catalog</p>
              <h3>جدول المنتجات</h3>
            </div>
            <div class="toolbar-actions">
              <input class="search-input" data-search-target="products" type="search" placeholder="ابحث في المنتجات">
            </div>
          </div>
          ${productTable}
        </article>
      </div>
    `;
  }

  function renderProductsTable(rows) {
    if (!rows.length) {
      return emptyState('مفيش منتجات مسجلة دلوقتي', 'ابدأ بإضافة أول منتج عشان يظهر هنا.');
    }

    const rowsHtml = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.title)}</td>
        <td>${escapeHtml(row.description || ' - ')}</td>
        <td>${formatCurrency(row.price)}</td>
        <td>${formatCurrency(row.original_price)}</td>
        <td>${nf.format(row.stock_qty)}</td>
        <td><span class="size-badge">${renderWeightLabel(row.bosta_weight)}</span></td>
        <td>${row.is_visible ? '<span class="status-badge success">ظاهر</span>' : '<span class="status-badge danger">مخفي</span>'}</td>
        <td>
          <div class="row-actions">
            <button class="mini-btn primary" type="button" data-action="edit-product" data-id="${escapeHtml(row.id)}">تعديل</button>
            <button class="mini-btn danger" type="button" data-action="delete-product" data-id="${escapeHtml(row.id)}">حذف</button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الوصف</th>
              <th>السعر</th>
              <th>قبل الخصم</th>
              <th>المخزون</th>
              <th>الوزن</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function renderOrders() {
    const orderFormOptions = state.data.products.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(product.title)} - ${formatCurrency(product.price)}</option>`).join('');
    const filteredOrders = filterByQuery(state.data.orders, state.ui.filters.orders, ['customer_name', 'phone', 'governorate', 'status', 'bosta_tracking_number']);

    refs.ordersRoot.innerHTML = `
      <div class="stack">
        <div class="grid two">
          <article class="card">
            <div class="section-toolbar">
              <div>
                <p class="eyebrow">Create</p>
                <h3>إنشاء أوردر جديد</h3>
              </div>
              <span class="pill">Backend shipping calc</span>
            </div>
            <form id="orderForm" class="section-form">
              <div class="field-grid cols-2">
                <label class="field">
                  <span>اسم العميل</span>
                  <input name="customer_name" required>
                </label>
                <label class="field">
                  <span>رقم الموبايل</span>
                  <input name="phone" required>
                </label>
              </div>
              <div class="field-grid cols-2">
                <label class="field">
                  <span>المحافظة</span>
                  <input name="governorate" required>
                </label>
                <label class="field">
                  <span>عنوان التوصيل</span>
                  <input name="address" required>
                </label>
              </div>
              <div class="field-grid cols-2">
                <label class="field">
                  <span>المنتج</span>
                  <select name="product_id" required>
                    <option value="">اختار المنتج</option>
                    ${orderFormOptions}
                  </select>
                </label>
                <label class="field">
                  <span>الكمية</span>
                  <input name="quantity" type="number" min="1" step="1" value="1" required>
                </label>
              </div>
              <label class="field">
                <span>ملاحظات</span>
                <textarea name="notes"></textarea>
              </label>
              <button class="primary-btn" type="submit">إنشاء الأوردر وطلب بوليصة بوسطة</button>
            </form>
          </article>

          <article class="card">
            <div class="section-toolbar">
              <div>
                <p class="eyebrow">Shipping</p>
                <h3>أسعار الشحن</h3>
              </div>
            </div>
            <div class="chip-list">
              ${state.data.shipping_rates.map((rate) => `<span class="chip">${escapeHtml(rate.zone_name || 'Zone')} - ${escapeHtml(formatWeightFees(rate))}</span>`).join('') || '<div class="empty-state">مفيش أسعار شحن لسه.</div>'}
            </div>
          </article>
        </div>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Orders</p>
              <h3>جدول الأوردرات</h3>
            </div>
            <input class="search-input" data-search-target="orders" type="search" placeholder="ابحث في الأوردرات">
          </div>
          ${renderOrdersTable(filteredOrders)}
        </article>
      </div>
    `;
  }

  function renderOrdersTable(rows) {
    if (!rows.length) {
      return emptyState('مفيش أوردرات موجودة', 'أول أوردر هيظهر هنا مباشرة بعد إنشاء بوليصة بوسطة.');
    }

    const html = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.customer_name || ' - ')}</td>
        <td>${escapeHtml(row.phone || ' - ')}</td>
        <td>${escapeHtml(row.governorate || ' - ')}</td>
        <td>${escapeHtml(row.address || ' - ')}</td>
        <td>${renderStatus(row.status)}</td>
        <td>${formatCurrency(row.total_amount)}</td>
        <td>${formatCurrency(row.shipping_fee)}</td>
        <td>${escapeHtml(row.bosta_tracking_number || ' - ')}</td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>الموبايل</th>
              <th>المحافظة</th>
              <th>العنوان</th>
              <th>الحالة</th>
              <th>الإجمالي</th>
              <th>الشحن</th>
              <th>Tracking</th>
            </tr>
          </thead>
          <tbody>${html}</tbody>
        </table>
      </div>
    `;
  }

  function renderStatus(status) {
    const value = String(status || '').toLowerCase();
    let className = 'status-badge';
    if (['new', 'active', 'label_created', 'approved', 'success'].includes(value)) className += ' success';
    else if (['pending', 'waiting', 'processing'].includes(value)) className += ' warn';
    else if (['rejected', 'cancelled', 'failed'].includes(value)) className += ' danger';
    return `<span class="${className}">${escapeHtml(status || ' - ')}</span>`;
  }

  function renderFinance() {
    refs.financeRoot.innerHTML = `
      <div class="stack">
        <div class="grid two">
          <article class="card">
            <div class="section-toolbar">
              <div>
                <p class="eyebrow">Expenses</p>
                <h3>مصروفات التشغيل</h3>
              </div>
            </div>
            <form id="expenseForm" class="section-form">
              <div class="field-grid cols-2">
                <label class="field">
                  <span>العنوان</span>
                  <input name="title" required>
                </label>
                <label class="field">
                  <span>المبلغ</span>
                  <input name="amount" type="number" min="0" step="1" required>
                </label>
              </div>
              <label class="field">
                <span>التصنيف</span>
                <input name="category" placeholder="شحن / مرتبات / تسويق">
              </label>
              <label class="field">
                <span>ملاحظات</span>
                <textarea name="note"></textarea>
              </label>
              <button class="primary-btn" type="submit">إضافة المصروف</button>
            </form>
          </article>

          <article class="card">
            <div class="section-toolbar">
              <div>
                <p class="eyebrow">Returns</p>
                <h3>المرتجعات</h3>
              </div>
            </div>
            <form id="returnForm" class="section-form">
              <div class="field-grid cols-2">
                <label class="field">
                  <span>رقم الأوردر</span>
                  <input name="order_number" required>
                </label>
                <label class="field">
                  <span>قيمة الخصم</span>
                  <input name="amount" type="number" min="0" step="1" required>
                </label>
              </div>
              <label class="field">
                <span>سبب المرتجع</span>
                <textarea name="reason"></textarea>
              </label>
              <button class="primary-btn" type="submit">تسجيل المرتجع</button>
            </form>
          </article>
        </div>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Summary</p>
              <h3>ملخص مالي</h3>
            </div>
          </div>
          <div class="grid three">
            ${statCard('إجمالي المصروفات', formatCurrency(state.data.operating_expenses.reduce((sum, row) => sum + toNumber(row.amount), 0)), `${state.data.operating_expenses.length} بند`, 'من operating_expenses')}
            ${statCard('قيمة المرتجعات', formatCurrency(state.data.returns.reduce((sum, row) => sum + toNumber(row.amount), 0)), `${state.data.returns.length} عملية`, 'من returns')}
            ${statCard('المبيعات الصافية', formatCurrency(state.data.orders.reduce((sum, row) => sum + toNumber(row.total_amount || row.subtotal + row.shipping_fee), 0)), `${state.data.orders.length} أوردر`, 'قبل الخصم النهائي')}
          </div>
        </article>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Records</p>
              <h3>سجل المصروفات والمرتجعات</h3>
            </div>
          </div>
          <div class="grid two">
            <div>
              <h4>مصروفات التشغيل</h4>
              ${renderSimpleList(state.data.operating_expenses, 'title', 'amount')}
            </div>
            <div>
              <h4>المرتجعات</h4>
              ${renderSimpleList(state.data.returns, 'order_number', 'amount')}
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function renderSimpleList(rows, keyA, keyB) {
    if (!rows.length) {
      return '<div class="empty-state">مفيش بيانات لسه.</div>';
    }
    return `
      <div class="stack">
        ${rows.map((row) => `
          <div class="chip" style="justify-content:space-between">
            <strong>${escapeHtml(row[keyA] || ' - ')}</strong>
            <span>${formatCurrency(row[keyB])}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  function renderCms() {
    const settings = state.data.site_settings[0] || {};

    refs.cmsRoot.innerHTML = `
      <div class="stack">
        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">CMS</p>
              <h3>إدارة محتوى الهيرو</h3>
            </div>
            <span class="pill">site_settings</span>
          </div>

          <form id="cmsForm" class="section-form">
            <div class="field-grid cols-2">
              <label class="field">
                <span>عنوان الهيرو</span>
                <input name="hero_title" value="${escapeHtml(settings.hero_title || '')}">
              </label>
              <label class="field">
                <span>النص الفرعي</span>
                <input name="hero_subtitle" value="${escapeHtml(settings.hero_subtitle || '')}">
              </label>
            </div>
            <label class="field">
              <span>صورة الهيرو</span>
              <input name="hero_image_url" value="${escapeHtml(settings.hero_image_url || '')}">
            </label>
            <div class="field-grid cols-2">
              <label class="field">
                <span>رقم التواصل</span>
                <input name="contact_phone" value="${escapeHtml(settings.contact_phone || '')}">
              </label>
              <label class="field">
                <span>واتساب</span>
                <input name="contact_whatsapp" value="${escapeHtml(settings.contact_whatsapp || '')}">
              </label>
            </div>
            <button class="primary-btn" type="submit">حفظ المحتوى</button>
          </form>
        </article>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Preview</p>
              <h3>معاينة سريعة</h3>
            </div>
          </div>
          <div class="grid two">
            <div>
              <h4>${escapeHtml(settings.hero_title || 'عنوان الهيرو')}</h4>
              <p class="muted">${escapeHtml(settings.hero_subtitle || 'النص الفرعي')}</p>
              <div class="chip-list">
                <span class="chip">${escapeHtml(settings.contact_phone || 'رقم التواصل')}</span>
                <span class="chip">${escapeHtml(settings.contact_whatsapp || 'واتساب')}</span>
              </div>
            </div>
            <div>
              ${settings.hero_image_url ? `<img class="preview-image" src="${escapeHtml(settings.hero_image_url)}" alt="Hero">` : '<div class="empty-state">الصورة هتظهر هنا بعد الحفظ.</div>'}
            </div>
          </div>
        </article>
      </div>
    `;
  }

  function renderEmployees() {
    const editing = state.data.employees.find((row) => String(row.id) === String(state.ui.editingEmployeeId)) || null;
    const filteredEmployees = filterByQuery(state.data.employees, state.ui.filters.employees, ['name', 'phone', 'role']);
    refs.employeesRoot.innerHTML = `
      <div class="stack">
        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Employees</p>
              <h3>${editing ? 'تعديل موظف' : 'إضافة موظف'}</h3>
            </div>
            <button class="mini-btn primary" type="button" data-action="new-request">طلب تعديل بياناتي</button>
          </div>
          <form id="employeeForm" class="section-form">
            <input type="hidden" name="id" value="${escapeHtml(editing?.id || '')}">
            <div class="field-grid cols-2">
              <label class="field">
                <span>الاسم</span>
                <input name="name" required value="${escapeHtml(editing?.name || '')}">
              </label>
              <label class="field">
                <span>الموبايل</span>
                <input name="phone" required value="${escapeHtml(editing?.phone || '')}">
              </label>
            </div>
            <div class="field-grid cols-2">
              <label class="field">
                <span>الدور</span>
                <select name="role">
                  <option value="employee" ${editing?.role === 'employee' ? 'selected' : ''}>موظف</option>
                  <option value="manager" ${editing?.role === 'manager' ? 'selected' : ''}>مدير</option>
                </select>
              </label>
              <label class="field">
                <span>كلمة السر</span>
                <input name="password" type="password" placeholder="${editing ? 'اتركها فارغة لو مش هتغيرها' : 'اكتب كلمة السر'}">
              </label>
            </div>
            <div>
              <p class="label">الصلاحيات</p>
              <div class="toggle-group">
                ${permissionCheckbox('orders', editing?.permissions?.orders, 'أوردرات')}
                ${permissionCheckbox('products', editing?.permissions?.products, 'منتجات')}
                ${permissionCheckbox('finance', editing?.permissions?.finance, 'ماليات')}
                ${permissionCheckbox('cms', editing?.permissions?.cms, 'CMS')}
                ${permissionCheckbox('employees', editing?.permissions?.employees, 'موظفين')}
              </div>
            </div>
            <button class="primary-btn" type="submit">${editing ? 'حفظ الموظف' : 'إضافة الموظف'}</button>
          </form>
        </article>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Roster</p>
              <h3>جدول الموظفين</h3>
            </div>
            <input class="search-input" data-search-target="employees" type="search" placeholder="ابحث في الموظفين">
          </div>
          ${renderEmployeesTable(filteredEmployees)}
        </article>
      </div>
    `;
  }

  function renderEmployeesTable(rows) {
    if (!rows.length) {
      return emptyState('مفيش موظفين مسجلين', 'ابدأ بإضافة أول موظف.');
    }

    const rowsHtml = rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.phone || ' - ')}</td>
        <td>${renderRoleBadge(row.role)}</td>
        <td>${renderPermissionsSummary(row.permissions)}</td>
        <td>${row.role === 'super_admin' ? '<span class="role-badge super">مفتوح بالكامل</span>' : '<span class="status-badge success">نشط</span>'}</td>
        <td>
          <div class="row-actions">
            <button class="mini-btn primary" type="button" data-action="edit-employee" data-id="${escapeHtml(row.id)}">تعديل</button>
            <button class="mini-btn danger" type="button" data-action="delete-employee" data-id="${escapeHtml(row.id)}">حذف</button>
          </div>
        </td>
      </tr>
    `).join('');

    return `
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الموبايل</th>
              <th>الدور</th>
              <th>الصلاحيات</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function renderRoleBadge(role) {
    const normalized = normalizeRole(role, 'employee');
    if (normalized === 'super_admin') return '<span class="role-badge super">مالك</span>';
    if (normalized === 'manager') return '<span class="role-badge">مدير</span>';
    return '<span class="role-badge">موظف</span>';
  }

  function permissionCheckbox(name, checked, label) {
    return `
      <label class="checkbox-pill">
        <input type="checkbox" name="perm_${name}" ${checked ? 'checked' : ''}>
        <span>${escapeHtml(label)}</span>
      </label>
    `;
  }

  function renderSecurity() {
    const requests = readSecurityRequests();
    refs.securityRoot.innerHTML = `
      <div class="stack">
        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Owner only</p>
              <h3>طلبات الأمان</h3>
            </div>
            <span class="pill">Visible to owner only</span>
          </div>
          ${requests.length ? requests.map(renderSecurityRequest).join('') : '<div class="empty-state">مفيش طلبات أمان لسه.</div>'}
        </article>

        <article class="card">
          <div class="section-toolbar">
            <div>
              <p class="eyebrow">Request</p>
              <h3>إرسال طلب جديد</h3>
            </div>
          </div>
          <form id="securityRequestForm" class="section-form">
            <div class="field-grid cols-2">
              <label class="field">
                <span>الاسم</span>
                <input name="name" required>
              </label>
              <label class="field">
                <span>الدور</span>
                <select name="role">
                  <option value="manager">مدير</option>
                  <option value="employee">موظف</option>
                </select>
              </label>
            </div>
            <label class="field">
              <span>المطلوب تغييره</span>
              <textarea name="request_text" required></textarea>
            </label>
            <button class="primary-btn" type="submit">إرسال للمالك</button>
          </form>
        </article>
      </div>
    `;
  }

  function renderSecurityRequest(row) {
    return `
      <div class="card" style="margin-bottom:12px">
        <div class="section-toolbar">
          <div>
            <h4>${escapeHtml(row.name || 'مستخدم')}</h4>
            <p class="muted">${escapeHtml(row.role || 'employee')} - ${formatDate(row.created_at)}</p>
          </div>
          ${renderStatus(row.status || 'pending')}
        </div>
        <p>${escapeHtml(row.request_text || row.text || '')}</p>
        <div class="row-actions">
          <button class="mini-btn primary" type="button" data-action="approve-request" data-id="${escapeHtml(row.id)}">موافقة</button>
          <button class="mini-btn danger" type="button" data-action="reject-request" data-id="${escapeHtml(row.id)}">رفض</button>
        </div>
      </div>
    `;
  }

  function emptyState(title, subtitle) {
    return `
      <div class="empty-state">
        <h4>${escapeHtml(title)}</h4>
        <p>${escapeHtml(subtitle)}</p>
      </div>
    `;
  }

  function getSettingValue(key, fallback) {
    const row = state.data.site_settings[0] || null;
    if (!row) return fallback;
    return row[key] ?? fallback;
  }

  function readSecurityRequests() {
    return Array.isArray(state.data.security_requests) ? state.data.security_requests : [];
  }

  async function handleProductSave(form) {
    if (!state.client) return;
    const data = new FormData(form);
    const id = data.get('id')?.toString().trim();
    const title = data.get('title')?.toString().trim();
    const price = toNumber(data.get('price'));
    const original_price = toNumber(data.get('original_price'));
    const stock_qty = toNumber(data.get('stock_qty'));
    const bosta_weight = data.get('bosta_weight')?.toString().trim() || 'small_medium';
    const description = data.get('description')?.toString().trim() || '';
    const is_visible = data.get('is_visible') === 'on';
    const image = form.querySelector('input[type="file"]')?.files?.[0] || null;

    try {
      let image_url = state.data.products.find((row) => String(row.id) === String(id))?.image_url || '';
      if (image) {
        const uploaded = await state.client.uploadFile(image, 'products');
        image_url = uploaded.publicUrl;
      }

      const payload = {
        title,
        description,
        price,
        original_price,
        image_url,
        stock_qty,
        bosta_weight,
        is_visible
      };

      if (id) {
        await state.client.update('products', payload, [`id=eq.${id}`]);
        toast('تم تحديث المنتج', 'success');
      } else {
        await state.client.insert('products', payload);
        toast('تمت إضافة المنتج', 'success');
      }

      state.ui.editingProductId = null;
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleOrderCreate(form) {
    if (!state.client) return;
    const data = new FormData(form);
    const productId = data.get('product_id')?.toString().trim();
    const product = state.data.products.find((row) => String(row.id) === String(productId));
    const quantity = toNumber(data.get('quantity')) || 1;
    const governorate = data.get('governorate')?.toString().trim();
    const rate = findShippingRateForGovernorate(governorate);

    if (!product) {
      toast('اختار المنتج الأول', 'error');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/bosta-create-label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: data.get('customer_name')?.toString().trim(),
            phone: normalizePhone(data.get('phone')),
            governorate,
            address: data.get('address')?.toString().trim(),
            notes: data.get('notes')?.toString().trim() || ''
          },
          order: {
            productId: product.id,
            productTitle: product.title,
            quantity,
            unitPrice: product.price,
            subtotal: product.price * quantity,
            shippingSize: product.bosta_weight,
            shippingFee: getFeeForWeight(rate, product.bosta_weight)
          },
          shippingSize: product.bosta_weight,
          governorate,
          orderNumber: `AWLAD-${Date.now()}`,
          persistOrder: true
        })
      });

      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || 'فشل إنشاء الأوردر');
      }

      toast('تم إنشاء الأوردر وبوليصة بوسطة', 'success');
      form.reset();
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleExpenseSave(form) {
    if (!state.client) return;
    const data = new FormData(form);
    try {
      await state.client.insert('operating_expenses', {
        title: data.get('title')?.toString().trim(),
        amount: toNumber(data.get('amount')),
        category: data.get('category')?.toString().trim() || 'تشغيل',
        note: data.get('note')?.toString().trim() || '',
        created_at: new Date().toISOString()
      });
      toast('تمت إضافة المصروف', 'success');
      form.reset();
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleReturnSave(form) {
    if (!state.client) return;
    const data = new FormData(form);
    try {
      await state.client.insert('returns', {
        order_number: data.get('order_number')?.toString().trim(),
        amount: toNumber(data.get('amount')),
        reason: data.get('reason')?.toString().trim() || '',
        status: 'pending',
        created_at: new Date().toISOString()
      });
      toast('تم تسجيل المرتجع', 'success');
      form.reset();
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleCmsSave(form) {
    if (!state.client) return;
    const data = new FormData(form);
    const payload = {
      hero_title: data.get('hero_title')?.toString().trim() || '',
      hero_subtitle: data.get('hero_subtitle')?.toString().trim() || '',
      hero_image_url: data.get('hero_image_url')?.toString().trim() || '',
      contact_phone: data.get('contact_phone')?.toString().trim() || '',
      contact_whatsapp: data.get('contact_whatsapp')?.toString().trim() || ''
    };

    try {
      const current = state.data.site_settings[0] || null;
      if (current?.id) {
        await state.client.update('site_settings', payload, [`id=eq.${current.id}`]);
      } else {
        await state.client.insert('site_settings', payload);
      }
      toast('تم حفظ المحتوى', 'success');
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleEmployeeSave(form) {
    if (!state.client) return;
    const data = new FormData(form);
    const id = data.get('id')?.toString().trim();
    const password = data.get('password')?.toString().trim() || '';
    const current = id ? state.data.employees.find((row) => String(row.id) === String(id)) || null : null;
    const permissions = {
      orders: form.querySelector('[name="perm_orders"]')?.checked || false,
      products: form.querySelector('[name="perm_products"]')?.checked || false,
      finance: form.querySelector('[name="perm_finance"]')?.checked || false,
      cms: form.querySelector('[name="perm_cms"]')?.checked || false,
      employees: form.querySelector('[name="perm_employees"]')?.checked || false
    };

    if (!id && !password) {
      toast('كلمة السر مطلوبة عند إضافة موظف جديد', 'error');
      return;
    }

    const payload = {
      name: data.get('name')?.toString().trim(),
      phone: normalizePhone(data.get('phone')),
      role: data.get('role')?.toString().trim() || 'employee',
      password_hash: password ? await hashText(password) : (current?.password_hash || ''),
      permissions: JSON.stringify(permissions)
    };

    try {
      if (id) {
        await state.client.update('employees', payload, [`id=eq.${id}`]);
        toast('تم تحديث الموظف', 'success');
      } else {
        await state.client.insert('employees', payload);
        toast('تمت إضافة الموظف', 'success');
      }
      state.ui.editingEmployeeId = null;
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function handleSecurityRequestSubmit(form) {
    const data = new FormData(form);
    const request = {
      name: data.get('name')?.toString().trim(),
      role: data.get('role')?.toString().trim(),
      request_text: data.get('request_text')?.toString().trim(),
      status: 'pending',
      created_at: new Date().toISOString()
    };

    try {
      await state.client.insert('security_requests', request);
      toast('تم إرسال طلب الأمان للمالك', 'success');
      form.reset();
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function updateSecurityRequest(id, status) {
    try {
      await state.client.update('security_requests', { status }, [`id=eq.${id}`]);
      toast(`تم ${status === 'approved' ? 'الموافقة' : 'رفض'} الطلب`, 'success');
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function deleteProduct(id) {
    if (!confirm('متأكد من حذف المنتج؟')) return;
    try {
      await state.client.remove('products', [`id=eq.${id}`]);
      toast('تم حذف المنتج', 'success');
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  async function deleteEmployee(id) {
    if (!confirm('متأكد من حذف الموظف؟')) return;
    try {
      await state.client.remove('employees', [`id=eq.${id}`]);
      toast('تم حذف الموظف', 'success');
      await refreshAll();
    } catch (error) {
      toast(error.message, 'error');
    }
  }

  function startEditProduct(id) {
    state.ui.editingProductId = id;
    renderProducts();
  }

  function startEditEmployee(id) {
    state.ui.editingEmployeeId = id;
    renderEmployees();
  }

  function openSecurityRequestDraft() {
    setSection('security');
  }

  function saveDraftFromCard() {}

  function isRecent(value, hours) {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return Date.now() - date.getTime() <= hours * 60 * 60 * 1000;
  }

  function renderPermissionsSummary(permissions) {
    if (!permissions || permissions.all) return '<span class="role-badge super">كل الصلاحيات</span>';
    const values = [];
    if (permissions.orders) values.push('أوردرات');
    if (permissions.products) values.push('منتجات');
    if (permissions.finance) values.push('ماليات');
    if (permissions.cms) values.push('CMS');
    if (permissions.employees) values.push('موظفين');
    return values.length ? values.join(' / ') : ' - ';
  }

  function getEditorValue(id) {
    return document.getElementById(id)?.value || '';
  }

  function toast(message, type = '') {
    if (!refs.toastStack) return;
    const node = document.createElement('div');
    node.className = `toast ${type}`.trim();
    node.textContent = message;
    refs.toastStack.appendChild(node);
    requestAnimationFrame(() => node.classList.add('show'));
    setTimeout(() => {
      node.classList.remove('show');
      setTimeout(() => node.remove(), 260);
    }, 3200);
  }

  function handleChangeEvent() {}

  function filterByQuery(rows, query, fields) {
    const needle = String(query || '').trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      fields.some((field) => String(row?.[field] ?? '').toLowerCase().includes(needle))
    );
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1200) {
      setSidebar(false);
    }
  });
})();
