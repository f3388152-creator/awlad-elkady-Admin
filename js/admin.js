/**
 * AWLAD EL-KADY — Admin Panel Logic (Local Storage Base)
 */

console.log('JS Loaded - Admin Script Started');
document.addEventListener('DOMContentLoaded', () => {
console.log('JS Loaded - DOMContentLoaded Triggered');

// ==========================================
// 1. STATE & DEFAULT DATA
// ==========================================
const DEFAULT_DATA = {
  hero: {
    prefix: "أهلاً بكم في",
    mainTitle: "معرض أولاد القاضي",
    suffix: "للأدوات المنزلية والمطبخ العصري",
    subtext: "تشكيلة مختارة بعناية من أجهزة المطبخ الفاخرة وأطقم الطهي العصرية. جودة حقيقية، ضمان موثوق، وتوصيل سريع لباب بيتك.",
    cta1: "تصفح المنتجات",
    cta2: "تواصل مباشر",
    img: "../assets/hero-bg.png"
  },
  announcement: {
    active: true,
    text: "🎉 عروض خاصة على أطقم الجرانيت هذا الأسبوع — تسوّق الآن!",
    bgColor: "#2C3E50",
    textColor: "#FFFFFF"
  },
  contact: {
    whatsapp: "01118060702",
    phone: "01118060702",
    address: "شارع الإصلاح الزراعي، بجوار عمر أفندي، أمام (المان) للعطور",
    maps: "",
    facebook: "",
    instagram: "",
    youtube: "",
    tiktok: ""
  },
  roles: {
    currentRole: 'owner',
    financeVisible: true,
    managers: [{ id: 'manager_1', name: 'أحمد', role: 'general_manager' }],
    permissions: {
      owner: ['manage_roles', 'manage_products', 'manage_discounts', 'manage_finance', 'manage_cms', 'accept_orders'],
      general_manager: ['manage_products', 'manage_discounts', 'manage_finance', 'manage_cms', 'view_reports'],
      customer_service: ['manage_customers', 'quick_discount', 'view_orders'],
      data_entry: ['add_products', 'update_product_data', 'view_inventory']
    }
  },
  platform: {
    brandName: 'أولاد القاضي | لوحة الإدارة',
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
  discounts: {
    promoCodes: [
      { id: 'promo_1', code: 'SALE10', type: 'percentage', value: 10, active: true },
      { id: 'promo_2', code: 'FREESHIP', type: 'fixed', value: 50, active: true }
    ]
  },
  cms: {
    storeName: 'أولاد القاضي',
    footerText: 'جميع الحقوق محفوظة © 2026 أولاد القاضي',
    footerEmail: 'hello@awladelkady.com',
    footerPhone: '01118060702'
  },
  employees: [
    {
      id: 'emp_owner',
      name: 'المالك',
      role: 'owner',
      permissions: {
        orders: { view: true, add: true, edit: true, delete: true },
        products: { view: true, add: true, edit: true, delete: true },
        content: { view: true, add: true, edit: true, delete: true },
        finance: { view: true, add: true, edit: true, delete: true },
        employees: { view: true, add: true, edit: true, delete: true },
        settings: { view: true, add: true, edit: true, delete: true },
        quickDiscount: true,
        updateBostaKeys: true
      }
    }
  ],
  categories: [
    { id: "kitchen-tools", name: "أدوات مطبخ" },
    { id: "serving-sets", name: "أطقم تقديم" }
  ],
  products: [],
  reviews: []
};

// Initialize DB
let db;
try {
  db = JSON.parse(localStorage.getItem('awladAdminDB'));
} catch (e) {
  console.error("Failed to parse DB from localStorage, resetting...", e);
  db = null;
}
if (!db || typeof db !== 'object') {
  db = DEFAULT_DATA;
  localStorage.setItem('awladAdminDB', JSON.stringify(db));
}

const authLogic = window.AdminBusinessLogic || {};
const AUTH_SESSION_KEY = 'awladAdminSession';
const SECURITY_REQUESTS_KEY = 'awladAdminSecurityRequests';
const loginForm = document.getElementById('loginForm');
const authScreen = document.getElementById('authScreen');
const welcomeScreen = document.getElementById('welcomeScreen');
const appShell = document.getElementById('appShell');
const authLogoTrigger = document.getElementById('authLogoTrigger');
const ownerPinModal = document.getElementById('ownerPinModal');
const securityRequestModal = document.getElementById('securityRequestModal');
const btnBackSection = document.getElementById('btnBackSection');
const btnLogout = document.getElementById('btnLogout');

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_SESSION_KEY));
  } catch (error) {
    return null;
  }
}

function persistSession(session) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function readSecurityRequests() {
  try {
    const data = JSON.parse(localStorage.getItem(SECURITY_REQUESTS_KEY));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
}

function storeSecurityRequests(list) {
  localStorage.setItem(SECURITY_REQUESTS_KEY, JSON.stringify(list));
}

function isOwnerSession() {
  const session = readSession();
  return session && session.role === 'owner';
}

function syncSidebarForSession() {
  const session = readSession();
  const securityLink = document.querySelector('.nav-item[data-section="security"]');
  if (securityLink) {
    securityLink.classList.toggle('hidden', !(session && session.role === 'owner'));
  }
}

function openModal(modal) {
  if (!modal) return;
  closeAllModals();
  modal.classList.remove('hidden');
}

function closeModal(modal) {
  if (!modal) return;
  modal.classList.add('hidden');
}

function closeAllModals() {
  [ownerPinModal, securityRequestModal].forEach((modal) => {
    if (modal) modal.classList.add('hidden');
  });
}

function setActiveView(view) {
  const views = {
    auth: authScreen,
    welcome: welcomeScreen,
    app: appShell
  };

  Object.entries(views).forEach(([key, element]) => {
    if (!element) return;
    const shouldShow = key === view;
    element.classList.toggle('hidden', !shouldShow);
  });

  closeAllModals();
  syncSidebarForSession();
}

function showWelcome(userName) {
  const welcomeUserName = document.getElementById('welcomeUserName');
  welcomeUserName.textContent = `أهلاً بك يا ${userName}.. جاري تجهيز مساحة العمل`;
  setActiveView('welcome');
  setTimeout(() => {
    setActiveView('app');
  }, 3000);
}

function hideAuthAndShowApp() {
  setActiveView('app');
}

function logoutUser() {
  localStorage.removeItem(AUTH_SESSION_KEY);
  setActiveView('auth');
  showToast('تم تسجيل الخروج بنجاح', 'success');
}

async function verifyLocalCredential(type, value) {
  const normalizedValue = String(value || '').trim();
  if (!normalizedValue) return false;

  if (type === 'owner') {
    return typeof authLogic.verifyOwnerPin === 'function' ? await authLogic.verifyOwnerPin(normalizedValue) : false;
  }

  const accounts = Array.isArray(db.employees) ? db.employees : [];
  const candidates = type === 'manager'
    ? accounts.filter((employee) => employee.role === 'general_manager')
    : accounts.filter((employee) => ['employee', 'customer_service', 'data_entry'].includes(employee.role));

  for (const account of candidates) {
    if (type === 'manager') {
      if (account.password && String(account.password).trim() === normalizedValue) return true;
      if (account.passwordHash && typeof authLogic.hashText === 'function') {
        const hashed = await authLogic.hashText(normalizedValue);
        if (hashed === account.passwordHash) return true;
      }
    }

    if (type === 'employee') {
      if (account.phone && String(account.phone).trim() === normalizedValue) return true;
      if (account.phoneHash && typeof authLogic.hashText === 'function') {
        const hashed = await authLogic.hashText(normalizedValue);
        if (hashed === account.phoneHash) return true;
      }
    }
  }

  if (type === 'manager' && typeof authLogic.verifyManagerPassword === 'function') {
    return await authLogic.verifyManagerPassword(normalizedValue);
  }

  if (type === 'employee' && typeof authLogic.verifyEmployeePhone === 'function') {
    return await authLogic.verifyEmployeePhone(normalizedValue);
  }

  return false;
}

async function performLogin(role, value) {
  const allowed = await verifyLocalCredential(role, value);
  if (!allowed) {
    showToast('بيانات الدخول غير صحيحة', 'error');
    return false;
  }

  const session = {
    role,
    userName: role === 'manager' ? 'مدير عام' : role === 'employee' ? 'موظف' : 'المالك',
    lastLoginAt: new Date().toISOString()
  };

  persistSession(session);
  showWelcome(session.userName);
  return true;
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const activeRole = document.querySelector('.auth-mode-btn.active')?.dataset.authRole || 'manager';

  if (activeRole === 'manager') {
    const password = document.getElementById('authPassword').value.trim();
    if (!password) {
      showToast('يرجى إدخال كلمة السر', 'error');
      return;
    }
    await performLogin('manager', password);
    return;
  }

  const phone = document.getElementById('authPhone').value.trim();
  if (!phone) {
    showToast('يرجى إدخال رقم الموبايل', 'error');
    return;
  }

  await performLogin('employee', phone);
}

function renderSecurityRequests() {
  const list = document.getElementById('securityRequestsList');
  if (!list) return;

  const requests = readSecurityRequests();
  if (!isOwnerSession()) {
    list.innerHTML = '<div class="security-request-empty">لا توجد صلاحية لعرض هذه الطلبات.</div>';
    return;
  }

  if (!requests.length) {
    list.innerHTML = '<div class="security-request-empty">لا توجد طلبات أمان حاليًا.</div>';
    return;
  }

  list.innerHTML = `
    <div class="security-request-table">
      <div class="security-request-row security-request-row-head">
        <div>الاسم</div>
        <div>نوع الطلب</div>
        <div>السبب</div>
        <div>الإجراء</div>
      </div>
      ${requests.map((request) => `
        <div class="security-request-row">
          <div class="security-request-name">${request.requesterName || request.user || request.name || (request.role === 'manager' ? 'مدير عام' : 'موظف')}</div>
          <div class="security-request-meta">${request.type === 'password' ? 'تغيير كلمة السر' : 'تغيير رقم الموبايل'}</div>
          <div class="security-request-meta">${request.reason || 'غير مذكور'}</div>
          <div class="security-request-actions">
            <button type="button" class="btn-ghost" data-request-action="approve" data-request-id="${request.id}">موافقة</button>
            <button type="button" class="btn-primary-admin" data-request-action="reject" data-request-id="${request.id}">رفض</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function handleSecurityRequestAction(event) {
  const target = event.target.closest('[data-request-action]');
  if (!target) return;

  const requestId = target.dataset.requestId;
  const action = target.dataset.requestAction;
  const requests = readSecurityRequests();
  const index = requests.findIndex((request) => request.id === requestId);
  if (index === -1) return;

  if (action === 'approve') {
    requests.splice(index, 1);
    storeSecurityRequests(requests);
    renderSecurityRequests();
    showToast('تمت الموافقة على طلب الأمان', 'success');
    return;
  }

  requests.splice(index, 1);
  storeSecurityRequests(requests);
  renderSecurityRequests();
  showToast('تم رفض طلب الأمان', 'error');
}

async function submitSecurityRequest() {
  const type = document.getElementById('securityRequestType').value;
  const requesterName = document.getElementById('securityRequestName')?.value.trim();
  const reason = document.getElementById('securityRequestReason').value.trim();
  const session = readSession();

  if (!requesterName) {
    showToast('يجب إدخال اسم الموظف أو المدير', 'error');
    return;
  }

  if (!reason) {
    showToast('يجب إدخال سبب الطلب', 'error');
    return;
  }

  const requests = readSecurityRequests();
  requests.unshift({
    id: `req_${Date.now()}`,
    type,
    requesterName,
    reason,
    role: session && session.role ? session.role : 'employee',
    createdAt: new Date().toISOString()
  });

  storeSecurityRequests(requests);
  closeModal(securityRequestModal);
  document.getElementById('securityRequestReason').value = '';
  const requesterNameInput = document.getElementById('securityRequestName');
  if (requesterNameInput) requesterNameInput.value = '';
  renderSecurityRequests();
  showToast('تم إرسال طلب تغيير بيانات الدخول إلى المالك', 'success');
}

function initializeAuthHandlers() {
  if (loginForm) {
    loginForm.addEventListener('submit', handleLoginSubmit);
  }

  document.querySelectorAll('.auth-mode-btn').forEach((button) => {
    button.addEventListener('click', () => {
      document.querySelectorAll('.auth-mode-btn').forEach((item) => item.classList.toggle('active', item === button));
      const role = button.dataset.authRole;
      document.querySelectorAll('[data-auth-field]').forEach((field) => {
        const match = field.dataset.authField === role;
        field.classList.toggle('hidden', !match);
      });
    });
  });

  function triggerOwnerPinModal(inputElement) {
    if (inputElement && inputElement.value) {
      inputElement.value = inputElement.value.replace(/@@/g, '');
    }
    openModal(ownerPinModal);
    const pinInput = document.getElementById('ownerPinInput');
    if (pinInput) setTimeout(() => pinInput.focus(), 150);
  }

  document.addEventListener('input', (event) => {
    if (event.target && typeof event.target.value === 'string' && event.target.value.includes('@@')) {
      triggerOwnerPinModal(event.target);
    }
  });

  let globalKeyBuffer = '';
  document.addEventListener('keyup', (event) => {
    if (event.key) {
      globalKeyBuffer += event.key;
      if (globalKeyBuffer.length > 10) globalKeyBuffer = globalKeyBuffer.slice(-10);
      if (globalKeyBuffer.includes('@@')) {
        globalKeyBuffer = '';
        const activeEl = document.activeElement;
        triggerOwnerPinModal(activeEl && activeEl.tagName === 'INPUT' ? activeEl : null);
      }
    }
  });

  document.querySelectorAll('[data-close-modal]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeModal(document.getElementById(button.dataset.closeModal));
    });
  });

  const requestBtn = document.getElementById('requestCredentialsBtn');
  if (requestBtn) {
    requestBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openModal(securityRequestModal);
    });
  }

  const submitOwnerPin = document.getElementById('submitOwnerPin');
  if (submitOwnerPin) {
    submitOwnerPin.addEventListener('click', async () => {
      const pin = document.getElementById('ownerPinInput').value.trim();
      if (!pin) {
        showToast('يرجى إدخال PIN Code', 'error');
        return;
      }

      const ok = await verifyLocalCredential('owner', pin);
      if (!ok) {
        showToast('PIN غير صحيح', 'error');
        return;
      }

      closeModal(ownerPinModal);
      document.getElementById('ownerPinInput').value = '';
      persistSession({ role: 'owner', userName: 'المالك', lastLoginAt: new Date().toISOString() });
      showWelcome('المالك');
    });
  }

  const submitSecurityRequestBtn = document.getElementById('submitSecurityRequest');
  if (submitSecurityRequestBtn) {
    submitSecurityRequestBtn.addEventListener('click', submitSecurityRequest);
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', (event) => {
      event.preventDefault();
      logoutUser();
    });
  }

  if (btnBackSection) {
    btnBackSection.addEventListener('click', (event) => {
      event.preventDefault();
      const currentActive = document.querySelector('.admin-section.active');
      const sectionsList = [...document.querySelectorAll('.admin-section')];
      const currentIndex = sectionsList.indexOf(currentActive);
      const nextIndex = currentIndex > 0 ? currentIndex - 1 : 0;
      const prevSection = sectionsList[nextIndex];
      if (!prevSection) return;
      document.querySelectorAll('.admin-section').forEach((section) => section.classList.remove('active'));
      prevSection.classList.add('active');
      const navMatch = document.querySelector(`.nav-item[data-section="${prevSection.id.replace('section-', '')}"]`);
      document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
      if (navMatch) navMatch.classList.add('active');
      const title = navMatch ? navMatch.querySelector('span:last-child').textContent : 'لوحة الإدارة';
      topbarTitle.textContent = title;
    });
  }

  const securityRequestList = document.getElementById('securityRequestsList');
  if (securityRequestList) {
    securityRequestList.addEventListener('click', handleSecurityRequestAction);
  }
}

window.renderSecurityRequests = function() {
  const list = document.getElementById('securityRequestsList');
  if (!list) return;
  const requests = readSecurityRequests();
  
  if (requests.length === 0) {
    list.innerHTML = `<div style="text-align:center; padding: 2rem; color: #888;">لا توجد طلبات أمان معلقة حالياً.</div>`;
    return;
  }
  
  list.innerHTML = requests.map((req, i) => `
    <div class="admin-card" style="padding: 1rem; border: 1px solid #ddd; background: #fafafa; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <h4 style="margin:0 0 0.25rem 0;">نوع الطلب: ${req.type === 'password' ? 'تغيير كلمة السر' : 'تغيير رقم الموبايل'}</h4>
        <p style="margin:0; font-size: 0.9rem; color:#555;">السبب: <strong>${req.reason || 'لم يتم ذكر سبب'}</strong> — الموظف: ${req.user || 'غير محدد'}</p>
      </div>
      <div style="display:flex; gap:0.5rem;">
        <button class="btn-primary-admin" data-index="${i}" data-action="approve" style="background-color:var(--success);">موافقة</button>
        <button class="btn-primary-admin" data-index="${i}" data-action="reject" style="background-color:#E74C3C;">رفض</button>
      </div>
    </div>
  `).join('');
};

window.handleSecurityRequestAction = function(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  const index = Number(button.dataset.index);
  
  let requests = readSecurityRequests();
  if (requests[index]) {
    requests.splice(index, 1);
    storeSecurityRequests(requests);
    renderSecurityRequests();
    showToast(`تم ${action === 'approve' ? 'الموافقة على' : 'رفض'} الطلب وتمت إزالته من القائمة.`);
  }
};

const session = readSession();
if (session) {
  hideAuthAndShowApp();
  if (session.role === 'owner') {
    renderSecurityRequests();
  }
} else {
  authScreen.classList.remove('hidden');
  appShell.classList.add('hidden');
}

initializeAuthHandlers();
const sidebar = document.getElementById('sidebar');
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.admin-section');
const topbarTitle = document.getElementById('topbarTitle');

// Sidebar toggle (Mobile)
const sidebarToggle = document.getElementById('sidebarToggle');
if(sidebarToggle) {
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });
}

// Section Switching
navItems.forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    if(window.innerWidth < 992) sidebar.classList.remove('open');
    
    // Update active nav
    document.querySelector('.nav-item.active').classList.remove('active');
    item.classList.add('active');
    
    // Update title
    topbarTitle.textContent = item.querySelector('span:last-child').textContent;
    
    // Switch section
    const targetSection = item.dataset.section;
    document.querySelector('.admin-section.active').classList.remove('active');
    document.getElementById(`section-${targetSection}`).classList.add('active');
  });
});

// Toast System
function showToast(msg, type = 'success') {
  const container = document.getElementById('adminToast');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `admin-toast ${type} show`;
  toast.innerHTML = type === 'success' ? `✅ <span>${msg}</span>` : `❌ <span>${msg}</span>`;
  
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// File Upload helper (returns Base64)
function setupImageUpload(inputId, dropzoneId, previewDivId, previewImgId) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const dropzone = document.getElementById(dropzoneId);
  const previewDiv = document.getElementById(previewDivId);
  const previewImg = document.getElementById(previewImgId);
  
  input.addEventListener('change', function() {
    const file = this.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        if(previewImgId === 'heroImgPreviewImg') db.hero.img = e.target.result;
        if(previewImgId === 'productImgPreviewImg') document.getElementById('productImgData').value = e.target.result;
        if(previewImgId === 'adminLogoPreviewImg') {
          db.platform.logo = e.target.result;
          const logoDataInput = document.getElementById('adminLogoData');
          if (logoDataInput) logoDataInput.value = e.target.result;
        }
        
        previewImg.src = e.target.result;
        previewDiv.style.display = 'block';
        dropzone.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }
  });
}

// Setup Uploads
setupImageUpload('heroImgInput', 'heroImgDropzone', 'heroImgPreview', 'heroImgPreviewImg');
setupImageUpload('productImgInput', 'productImgDropzone', 'productImgPreview', 'productImgPreviewImg');
setupImageUpload('adminLogoInput', 'adminLogoDropzone', 'adminLogoPreview', 'adminLogoPreviewImg');

// Remove Images
document.getElementById('heroImgRemove').addEventListener('click', (e) => {
  e.preventDefault();
  document.getElementById('heroImgPreview').style.display = 'none';
  document.getElementById('heroImgDropzone').style.display = 'block';
  db.hero.img = '';
});

const adminLogoRemove = document.getElementById('adminLogoRemove');
if (adminLogoRemove) {
  adminLogoRemove.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('adminLogoPreview').style.display = 'none';
    document.getElementById('adminLogoDropzone').style.display = 'block';
    const logoDataInput = document.getElementById('adminLogoData');
    if (logoDataInput) logoDataInput.value = '';
    if (db.platform) db.platform.logo = '';
  });
}

const productImgRemove = document.getElementById('productImgRemove');
if (productImgRemove) {
  productImgRemove.addEventListener('click', (e) => {
    e.preventDefault();
    document.getElementById('productImgPreview').style.display = 'none';
    document.getElementById('productImgDropzone').style.display = 'block';
    const productDataInput = document.getElementById('productImgData');
    if (productDataInput) productDataInput.value = '';
  });
}

// ==========================================
// 3. LOAD DATA INTO UI
// ==========================================
function loadData() {
  // Hero
  document.getElementById('heroPrefixText').value = db.hero.prefix || '';
  document.getElementById('heroMainTitle').value = db.hero.mainTitle || '';
  document.getElementById('heroSuffixText').value = db.hero.suffix || '';
  document.getElementById('heroSubtext').value = db.hero.subtext || '';
  document.getElementById('heroCta1Text').value = db.hero.cta1 || '';
  document.getElementById('heroCta2Text').value = db.hero.cta2 || '';
  if(db.hero.img) {
    document.getElementById('heroImgPreviewImg').src = db.hero.img;
    document.getElementById('heroImgDropzone').style.display = 'none';
    document.getElementById('heroImgPreview').style.display = 'block';
  }

  // Announcement
  const ann = db.announcement;
  document.getElementById('announcementToggle').checked = ann.active;
  document.getElementById('announcementStatus').textContent = ann.active ? 'مفعّل' : 'معطّل';
  document.getElementById('announcementText').value = ann.text || '';
  document.getElementById('announcementBgColor').value = ann.bgColor || '#2C3E50';
  document.getElementById('announcementBgHex').value = ann.bgColor || '#2C3E50';
  document.getElementById('announcementTextColor').value = ann.textColor || '#FFFFFF';
  document.getElementById('announcementTextHex').value = ann.textColor || '#FFFFFF';
  updateAnnouncementPreview();

  // White-label and sidebar
  if (db.platform) {
    updateSidebarSettings();
    if (db.platform.logo) {
      document.getElementById('adminLogoPreviewImg').src = db.platform.logo;
      document.getElementById('adminLogoPreview').style.display = 'block';
      document.getElementById('adminLogoDropzone').style.display = 'none';
      document.getElementById('adminLogoData').value = db.platform.logo;
    }
    document.getElementById('adminBrandName').value = db.platform.brandName || 'أولاد القاضي | لوحة الإدارة';
  }

  // Roles & permissions
  if (db.roles) {
    const currentRole = db.roles.currentRole || 'owner';
    document.getElementById('adminCurrentRole').value = currentRole;
    document.getElementById('financeVisibilityToggle').checked = !!db.roles.financeVisible;
    document.getElementById('financeVisibilityStatus').value = db.roles.financeVisible ? 'ظاهر' : 'مخفي';
    renderPermissions();
    renderPromoCodes();
    renderPermissionMatrix();
  }

  // CMS
  if (db.cms) {
    document.getElementById('footerStoreName').value = db.cms.storeName || 'أولاد القاضي';
    document.getElementById('footerCopyright').value = db.cms.footerText || '';
    document.getElementById('footerEmail').value = db.cms.footerEmail || '';
    document.getElementById('footerPhone').value = db.cms.footerPhone || '';
  }

  // Contact
  const c = db.contact;
  document.getElementById('contactWhatsapp').value = c.whatsapp || '';
  document.getElementById('contactPhone').value = c.phone || '';
  document.getElementById('contactAddress').value = c.address || '';
  document.getElementById('contactMapsUrl').value = c.maps || '';
  document.getElementById('socialFacebook').value = c.facebook || '';
  document.getElementById('socialInstagram').value = c.instagram || '';
  document.getElementById('socialYoutube').value = c.youtube || '';
  document.getElementById('socialTiktok').value = c.tiktok || '';

  // Render lists
  renderCategories();
  renderProducts();
  renderReviews();
  renderOwnerSidebar();
}

// ==========================================
// 4. ANNOUNCEMENT LIVE PREVIEW
// ==========================================
function updateAnnouncementPreview() {
  const preview = document.getElementById('announcementPreview');
  preview.textContent = document.getElementById('announcementText').value;
  preview.style.backgroundColor = document.getElementById('announcementBgColor').value;
  preview.style.color = document.getElementById('announcementTextColor').value;
}

document.getElementById('announcementText').addEventListener('input', updateAnnouncementPreview);
document.getElementById('announcementBgColor').addEventListener('input', (e) => {
  document.getElementById('announcementBgHex').value = e.target.value.toUpperCase();
  updateAnnouncementPreview();
});
document.getElementById('announcementTextColor').addEventListener('input', (e) => {
  document.getElementById('announcementTextHex').value = e.target.value.toUpperCase();
  updateAnnouncementPreview();
});
document.getElementById('announcementToggle').addEventListener('change', (e) => {
  document.getElementById('announcementStatus').textContent = e.target.checked ? 'مفعّل' : 'معطّل';
});

// ==========================================
// 5. ROLES + DISCOUNTS + FINANCE LOGIC
// ==========================================
const ROLE_LABELS = {
  owner: 'المالك',
  general_manager: 'مدير عام',
  customer_service: 'خدمة عملاء',
  data_entry: 'مدخل بيانات'
};

function canRole(permission, role = db.roles.currentRole) {
  if (role === 'owner') return true;
  const permissions = db.roles.permissions?.[role] || [];
  return permissions.includes(permission);
}

function renderPermissions() {
  const list = document.getElementById('permissionsList');
  if (!list) return;
  const role = document.getElementById('adminCurrentRole').value;
  let permissions = db.roles.permissions?.[role] || [];

  const normalizedPermissions = [
    ['manage_roles', 'إضافة مدير عام وتحديد الصلاحيات'],
    ['manage_products', 'إدارة المنتجات'],
    ['manage_discounts', 'إضافة/تعديل Promo Codes'],
    ['manage_finance', 'إظهار قسم الماليات'],
    ['manage_cms', 'إدارة المحتوى'],
    ['quick_discount', 'خصم إقناع حتى 50 جنيه'],
    ['add_products', 'إضافة منتج جديد'],
    ['update_product_data', 'تحديث بيانات المنتج'],
    ['view_orders', 'عرض الطلبات'],
    ['manage_customers', 'إدارة العملاء']
  ];

  const isOwner = role === 'owner';
  const ownerPermissions = normalizedPermissions.map((permission) => permission[0]);
  const effectivePermissions = isOwner ? ownerPermissions : permissions;

  list.innerHTML = normalizedPermissions.map(([key, label]) => `
    <div class="permission-item ${effectivePermissions.includes(key) ? 'enabled' : ''} ${isOwner ? 'owner-locked' : ''}">
      <span>${label}</span>
      <span class="permission-pill">${effectivePermissions.includes(key) ? 'مسموح' : 'ممنوع'}</span>
    </div>
  `).join('');
}

function updateFinanceVisibility() {
  const role = document.getElementById('adminCurrentRole').value;
  const toggle = document.getElementById('financeVisibilityToggle');
  const status = document.getElementById('financeVisibilityStatus');

  if (role === 'owner' || role === 'general_manager') {
    toggle.disabled = false;
    db.roles.financeVisible = toggle.checked;
    status.value = toggle.checked ? 'ظاهر' : 'مخفي';
  } else {
    toggle.checked = false;
    toggle.disabled = true;
    db.roles.financeVisible = false;
    status.value = 'مخفي';
  }
}

function renderPromoCodes() {
  const list = document.getElementById('promoCodesList');
  const promoCodes = db.discounts.promoCodes || [];

  list.innerHTML = promoCodes.map((promo) => `
    <div class="promo-item">
      <div>
        <strong>${promo.code}</strong>
        <span>${promo.type === 'percentage' ? `${promo.value}%` : `${promo.value} ج.م`}</span>
      </div>
      <div class="promo-actions">
        <button class="btn-action-sm" data-code="${promo.id}" data-action="togglePromo">${promo.active ? '✅' : '⏸️'}</button>
        <button class="btn-action-sm delete" data-code="${promo.id}" data-action="deletePromo">🗑️</button>
      </div>
    </div>
  `).join('');
}

function renderPermissionMatrix() {
  const matrix = document.getElementById('permissionMatrix');
  if (!matrix) return;

  const rows = [
    { key: 'orders', label: 'الطلبات' },
    { key: 'products', label: 'المنتجات' },
    { key: 'content', label: 'محتوى الموقع' },
    { key: 'finance', label: 'الماليات' },
    { key: 'employees', label: 'الموظفين' },
    { key: 'settings', label: 'الإعدادات' }
  ];

  const actions = ['view', 'add', 'edit', 'delete'];
  const extra = [
    { key: 'quickDiscount', label: 'خصم إقناع حتى 50 ج' },
    { key: 'updateBostaKeys', label: 'تعديل مفاتيح بوسطة' }
  ];

  const employeeName = document.getElementById('employeeNameInput')?.value.trim();
  const employeeRole = document.getElementById('employeeRoleInput')?.value || 'customer_service';
  const employee = (db.employees || []).find((item) => item.name === employeeName && item.role === employeeRole) || { permissions: {} };
  const permissions = employee.permissions || {};

  const rowsHtml = rows.map((row) => `
    <tr>
      <td>${row.label}</td>
      ${actions.map((action) => `
        <td><input type="checkbox" data-section="${row.key}" data-action="${action}" ${permissions[row.key]?.[action] ? 'checked' : ''}></td>
      `).join('')}
    </tr>
  `).join('');

  const extrasHtml = extra.map((item) => `
    <label class="extra-permission-item">
      <input type="checkbox" data-extra="${item.key}" ${permissions[item.key] ? 'checked' : ''}>
      <span>${item.label}</span>
    </label>
  `).join('');

  matrix.innerHTML = `
    <table class="permission-table">
      <thead>
        <tr>
          <th>القسم</th>
          <th>عرض</th>
          <th>إضافة</th>
          <th>تعديل</th>
          <th>حذف</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
    <div class="extra-permissions">
      ${extrasHtml}
    </div>
  `;
}

document.getElementById('adminCurrentRole').addEventListener('change', () => {
  db.roles.currentRole = document.getElementById('adminCurrentRole').value;
  updateFinanceVisibility();
  renderPermissions();
});

document.getElementById('financeVisibilityToggle').addEventListener('change', (event) => {
  db.roles.financeVisible = event.target.checked;
  document.getElementById('financeVisibilityStatus').value = event.target.checked ? 'ظاهر' : 'مخفي';
});

const btnAddAccount = document.getElementById('btnAddAccount');
if (btnAddAccount) {
  btnAddAccount.addEventListener('click', () => {
    const name = document.getElementById('newAccountName').value.trim();
    const role = document.getElementById('newAccountRole').value;
    const password = document.getElementById('newManagerPassword').value.trim();
    const phone = document.getElementById('newEmployeePhone').value.trim();

    if (!name) return showToast('يرجى كتابة اسم الحساب', 'error');

    if (role === 'general_manager' && (!password || password.length < 4)) {
      return showToast('يرجى إدخال كلمة سر صالحة للمدير (4 حروف أو أرقام على الأقل)', 'error');
    }
    
    if (role === 'employee' && (!phone || phone.length < 10)) {
      return showToast('يرجى إدخال رقم موبايل صحيح للموظف', 'error');
    }

    db.employees = db.employees || [];
    db.employees.push({
      id: 'acc_' + Date.now(),
      name,
      role,
      password: role === 'general_manager' ? password : null,
      phone: role === 'employee' ? phone : null,
      permissions: {}
    });

    document.getElementById('newAccountName').value = '';
    document.getElementById('newManagerPassword').value = '';
    document.getElementById('newEmployeePhone').value = '';
    showToast('تمت إضافة الحساب بنجاح');
  });
}

document.getElementById('btnAddPromoCode').addEventListener('click', () => {
  const code = prompt('اكتب كود الخصم (مثل: SALE10):');
  if (!code) return;
  const type = prompt('نوع الخصم؟ اكتب percentage أو fixed', 'percentage');
  const value = Number(prompt('قيمة الخصم؟', '10'));

  if (!code || !Number.isFinite(value)) {
    showToast('بيانات الكود غير صحيحة', 'error');
    return;
  }

  db.discounts.promoCodes.push({
    id: 'promo_' + Date.now(),
    code: code.trim().toUpperCase(),
    type: type === 'fixed' ? 'fixed' : 'percentage',
    value,
    active: true
  });

  renderPromoCodes();
  showToast('تمت إضافة كود الخصم');
});

document.getElementById('btnAddEmployeePermission').addEventListener('click', () => {
  const employeeName = document.getElementById('employeeNameInput').value.trim();
  if (!employeeName) return showToast('يرجى كتابة اسم الموظف', 'error');

  const permissions = {};
  const rows = ['orders', 'products', 'content', 'finance', 'employees', 'settings'];
  const actions = ['view', 'add', 'edit', 'delete'];

  rows.forEach((section) => {
    permissions[section] = {};
    actions.forEach((action) => {
      const input = document.querySelector(`input[data-section="${section}"][data-action="${action}"]`);
      permissions[section][action] = Boolean(input && input.checked);
    });
  });

  permissions.quickDiscount = Boolean(document.querySelector('input[data-extra="quickDiscount"]')?.checked);
  permissions.updateBostaKeys = Boolean(document.querySelector('input[data-extra="updateBostaKeys"]')?.checked);

  db.employees = db.employees || [];
  
  const existingIndex = db.employees.findIndex(emp => emp.name === employeeName);
  if (existingIndex > -1) {
    db.employees[existingIndex].role = document.getElementById('employeeRoleInput').value;
    db.employees[existingIndex].permissions = permissions;
  } else {
    db.employees.push({
      id: 'emp_' + Date.now(),
      name: employeeName,
      role: document.getElementById('employeeRoleInput').value,
      permissions
    });
  }

  renderPermissionMatrix();
  document.getElementById('employeeNameInput').value = '';
  showToast('تم حفظ صلاحيات الموظف بنجاح');
});

document.getElementById('promoCodesList').addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const action = button.dataset.action;
  const promoId = button.dataset.code;
  const promo = (db.discounts.promoCodes || []).find(item => item.id === promoId);
  if (!promo) return;

  if (action === 'togglePromo') {
    promo.active = !promo.active;
  } else if (action === 'deletePromo') {
    db.discounts.promoCodes = db.discounts.promoCodes.filter(item => item.id !== promoId);
  }

  renderPromoCodes();
});

document.getElementById('btnQuickDiscount').addEventListener('click', () => {
  const total = Number(document.getElementById('quickDiscountTotal').value || 0);
  const discount = Number(document.getElementById('quickDiscountAmount').value || 0);
  const result = document.getElementById('quickDiscountResult');

  if (!Number.isFinite(total) || total <= 0) {
    result.textContent = 'إجمالي الطلب غير صحيح';
    result.classList.add('error');
    return;
  }

  if (!Number.isFinite(discount) || discount < 0) {
    result.textContent = 'قيمة الخصم غير صحيحة';
    result.classList.add('error');
    return;
  }

  if (discount > 50) {
    result.textContent = 'حد الخصم الإقناعي هو 50 جنيه كحد أقصى';
    result.classList.add('error');
    return;
  }

  const finalTotal = Math.max(total - discount, 0);
  result.textContent = `الإجمالي النهائي: ${finalTotal} ج.م`;
  result.classList.remove('error');
});

function updateSidebarSettings() {
  const list = document.getElementById('sidebarSettingsList');
  if (!list || !db.platform?.sidebar) return;

  list.innerHTML = db.platform.sidebar.map((item) => `
    <div class="sidebar-setting-item">
      <div class="sidebar-setting-label">
        <input type="text" class="form-control" data-sidebar-label="${item.id}" value="${item.label}">
      </div>
      <label class="toggle-switch">
        <input type="checkbox" data-sidebar-toggle="${item.id}" ${item.visible ? 'checked' : ''}>
        <span class="toggle-track"></span>
      </label>
    </div>
  `).join('');

  list.querySelectorAll('[data-sidebar-label]').forEach((input) => {
    input.addEventListener('change', () => {
      const item = db.platform.sidebar.find((section) => section.id === input.dataset.sidebarLabel);
      if (item) item.label = input.value.trim() || item.label;
    });
  });

  list.querySelectorAll('[data-sidebar-toggle]').forEach((input) => {
    input.addEventListener('change', () => {
      const item = db.platform.sidebar.find((section) => section.id === input.dataset.sidebarToggle);
      if (item) item.visible = input.checked;
    });
  });
}

function renderOwnerSidebar() {
  const sidebar = document.getElementById('sidebar');
  const nav = sidebar?.querySelector('.sidebar-nav');
  if (!nav || !db.platform?.sidebar) return;

  nav.innerHTML = db.platform.sidebar
    .filter((item) => item.visible)
    .map((item) => `
      <a href="#" class="nav-item ${item.id === 'hero' ? 'active' : ''}" data-section="${item.id}">
        <span class="nav-icon">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18"/></svg>
        </span>
        <span>${item.label}</span>
      </a>
    `).join('');

  nav.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetSection = item.dataset.section;
      const target = document.getElementById(`section-${targetSection}`);
      if (!target) return;
      document.querySelectorAll('.admin-section').forEach((section) => section.classList.remove('active'));
      target.classList.add('active');
      document.querySelectorAll('.nav-item').forEach((link) => link.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('topbarTitle').textContent = item.querySelector('span:last-child').textContent;
    });
  });
}

function renderCategories() {
  const container = document.getElementById('categoriesList');
  const select = document.getElementById('productCategory');
  container.innerHTML = '';
  select.innerHTML = '<option value="" disabled selected>اختر القسم...</option>';
  
  db.categories.forEach(cat => {
    // List tag
    const div = document.createElement('div');
    div.className = 'category-tag';
    div.innerHTML = `
      ${cat.name}
      <button class="del-btn" onclick="deleteCategory('${cat.id}')">×</button>
    `;
    container.appendChild(div);
    
    // Select option
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    select.appendChild(opt);
  });
}

// Open Cat Modal
document.getElementById('btnAddCategory').addEventListener('click', () => {
  document.getElementById('categoryNameAr').value = '';
  document.getElementById('categorySlug').value = '';
  document.getElementById('categoryModal').classList.add('active');
});

// Close Cat Modal
document.getElementById('closeCategoryModal').addEventListener('click', () => document.getElementById('categoryModal').classList.remove('active'));
document.getElementById('cancelCategoryModal').addEventListener('click', () => document.getElementById('categoryModal').classList.remove('active'));

// Save Cat
document.getElementById('btnSaveCategory').addEventListener('click', () => {
  const name = document.getElementById('categoryNameAr').value.trim();
  let id = document.getElementById('categorySlug').value.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  if(!name || !id) return showToast('يرجى تعبئة الحقول المطلوبة', 'error');
  
  db.categories.push({ id, name });
  renderCategories();
  document.getElementById('categoryModal').classList.remove('active');
  showToast('تمت إضافة القسم بنجاح');
});

window.deleteCategory = (id) => {
  if(confirm('هل أنت متأكد من حذف القسم؟ ستبقى المنتجات المرتبطة به لكن بدون قسم صالح.')) {
    db.categories = db.categories.filter(c => c.id !== id);
    renderCategories();
    showToast('تم حذف القسم', 'success');
  }
};

// ==========================================
// 6. PRODUCTS MANAGER
// ==========================================
function renderProducts() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = '';
  
  db.products.forEach(prod => {
    const catName = db.categories.find(c => c.id === prod.category)?.name || 'غير محدد';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="product-cell-info">
          <img src="${prod.img || '../assets/logo.jpg'}" class="product-cell-img">
          <span class="product-cell-title">${prod.title}</span>
        </div>
      </td>
      <td>${catName}</td>
      <td>${prod.price} ج.م</td>
      <td>${prod.badge || '—'}</td>
      <td>
        <label class="toggle-switch" style="transform:scale(0.8);">
          <input type="checkbox" onchange="toggleProductVisibility('${prod.id}', this)" ${prod.hidden ? '' : 'checked'}>
          <span class="toggle-track"></span>
        </label>
      </td>
      <td>
        <div class="cell-actions">
          <button class="btn-action-sm" onclick="editProduct('${prod.id}')" title="تعديل">✏️</button>
          <button class="btn-action-sm delete" onclick="deleteProduct('${prod.id}')" title="حذف">🗑️</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Visibility Toggle
window.toggleProductVisibility = (id, checkbox) => {
  const prod = db.products.find(p => p.id === id);
  if(prod) prod.hidden = !checkbox.checked;
};

// Open Product Modal (Add/Edit)
document.getElementById('btnAddProduct').addEventListener('click', () => {
  document.getElementById('productId').value = '';
  document.getElementById('productModalTitle').textContent = 'إضافة منتج جديد';
  
  // Clear form
  ['productName','productCategory','productSpec','productPrice','productOriginalPrice','productBostaSize','productDiscount','productBadge','productFeatures','productImgData']
    .forEach(id => document.getElementById(id).value = '');
    
  document.getElementById('productImgDropzone').style.display = 'flex';
  document.getElementById('productImgPreview').style.display = 'none';
  
  document.getElementById('productModal').classList.add('active');
});

// Close Product Modal
document.getElementById('closeProductModal').addEventListener('click', () => document.getElementById('productModal').classList.remove('active'));
document.getElementById('cancelProductModal').addEventListener('click', () => document.getElementById('productModal').classList.remove('active'));

window.editProduct = (id) => {
  const p = db.products.find(x => x.id === id);
  if(!p) return;
  
  document.getElementById('productId').value = p.id;
  document.getElementById('productModalTitle').textContent = 'تعديل منتج';
  
  document.getElementById('productName').value = p.title || '';
  document.getElementById('productCategory').value = p.category || '';
  document.getElementById('productSpec').value = p.spec || '';
  document.getElementById('productPrice').value = p.price || '';
  document.getElementById('productOriginalPrice').value = p.originalPrice || '';
  document.getElementById('productBostaSize').value = p.bostaSize || '';
  document.getElementById('productDiscount').value = p.discount || '';
  document.getElementById('productBadge').value = p.badge || '';
  document.getElementById('productFeatures').value = (p.features || '').replace(/\\n/g, '\n');
  document.getElementById('productImgData').value = p.img || '';
  
  if(p.img) {
    document.getElementById('productImgPreviewImg').src = p.img;
    document.getElementById('productImgDropzone').style.display = 'none';
    document.getElementById('productImgPreview').style.display = 'flex';
  } else {
    document.getElementById('productImgDropzone').style.display = 'flex';
    document.getElementById('productImgPreview').style.display = 'none';
  }
  
  document.getElementById('productModal').classList.add('active');
};

// Save Product
document.getElementById('btnSaveProduct').addEventListener('click', () => {
  const title = document.getElementById('productName').value.trim();
  const cat = document.getElementById('productCategory').value;
  const price = document.getElementById('productPrice').value;
  const bostaSize = document.getElementById('productBostaSize').value;
  
  if(!title || !cat || !price || !bostaSize) return showToast('يرجى تعبئة (الاسم، القسم، السعر، وحجم الشحنة) على الأقل', 'error');

  const pData = {
    title,
    category: cat,
    price: parseInt(price),
    originalPrice: parseInt(document.getElementById('productOriginalPrice').value) || null,
    discount: parseInt(document.getElementById('productDiscount').value) || null,
    bostaSize,
    spec: document.getElementById('productSpec').value.trim(),
    badge: document.getElementById('productBadge').value,
    features: document.getElementById('productFeatures').value.trim(),
    img: document.getElementById('productImgData').value
  };
  
  const existingId = document.getElementById('productId').value;
  if(existingId) {
    // Edit
    const idx = db.products.findIndex(x => x.id === existingId);
    if(idx > -1) {
      db.products[idx] = { ...db.products[idx], ...pData };
      showToast('تم تعديل المنتج بنجاح');
    }
  } else {
    // Add
    pData.id = 'prod_' + Date.now();
    pData.hidden = false;
    db.products.push(pData);
    showToast('تمت إضافة المنتج بنجاح');
  }
  
  renderProducts();
  document.getElementById('productModal').classList.remove('active');
});

window.deleteProduct = (id) => {
  if(confirm('حذف هذا المنتج نهائياً؟')) {
    db.products = db.products.filter(p => p.id !== id);
    renderProducts();
    showToast('تم حذف المنتج', 'success');
  }
};

// ==========================================
// 7. REVIEWS MANAGER
// ==========================================
let currentRating = 5;

// Stars interactions
const stars = document.querySelectorAll('.star-btn');
stars.forEach(star => {
  star.addEventListener('click', (e) => {
    currentRating = parseInt(e.target.dataset.val);
    document.getElementById('reviewRating').value = currentRating;
    stars.forEach(s => {
      s.classList.toggle('active', parseInt(s.dataset.val) <= currentRating);
    });
  });
});

function renderReviews() {
  const container = document.getElementById('reviewsList');
  document.getElementById('reviewsCount').textContent = db.reviews.length;
  container.innerHTML = '';
  
  db.reviews.forEach(rev => {
    const starsHtml = '★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating);
    const verifiedBadge = rev.verified ? '<span class="verified-badge">✓ مشتري مؤكد</span>' : '';
    const div = document.createElement('div');
    div.className = 'review-item';
    div.innerHTML = `
      <div class="review-item-header">
        <div>
          <div class="review-item-name-row">
            <div class="review-item-name">${rev.name}</div>
            ${verifiedBadge}
          </div>
          <div class="review-item-city">${rev.city || ''}</div>
        </div>
        <div class="review-item-stars">${starsHtml}</div>
      </div>
      <div class="review-item-text">"${rev.text}"</div>
      <div class="review-item-actions">
        <button class="btn-action-sm" onclick="editReview('${rev.id}')">✏️</button>
        <button class="btn-action-sm delete" onclick="deleteReview('${rev.id}')">🗑️</button>
      </div>
    `;
    container.appendChild(div);
  });
}

document.getElementById('btnSaveReview').addEventListener('click', () => {
  const name = document.getElementById('reviewName').value.trim();
  const text = document.getElementById('reviewText').value.trim();
  const city = document.getElementById('reviewCity').value.trim();
  
  if(!name || !text) return showToast('الاسم ونص الرأي مطلوبان', 'error');
  
  const idEl = document.getElementById('editingReviewId');
  if(idEl.value) {
    // Edit
    const r = db.reviews.find(x => x.id === idEl.value);
    if(r) {
      r.name = name; r.text = text; r.city = city; r.rating = currentRating; r.verified = true;
    }
  } else {
    // Add
    db.reviews.unshift({
      id: 'rev_' + Date.now(),
      name, text, city, rating: currentRating, verified: true
    });
  }
  
  localStorage.setItem('awladAdminDB', JSON.stringify(db));
  renderReviews();
  resetReviewForm();
  showToast('تم حفظ الرأي');
});

const cmsReviewStars = document.querySelectorAll('#cmsReviewStars .star-btn');
const cmsReviewRating = () => Number(document.getElementById('cmsReviewRating')?.value || 5);

cmsReviewStars.forEach((star) => {
  star.addEventListener('click', (e) => {
    const val = Number(e.target.dataset.val);
    document.getElementById('cmsReviewRating').value = val;
    cmsReviewStars.forEach((item) => {
      item.classList.toggle('active', Number(item.dataset.val) <= val);
    });
  });
});

document.getElementById('btnAddCmsReview').addEventListener('click', () => {
  const name = document.getElementById('reviewCustomerName').value.trim();
  const city = document.getElementById('reviewCityName').value.trim();
  const text = document.getElementById('reviewTextInput').value.trim();
  const rating = cmsReviewRating();

  if (!name || !text) {
    return showToast('اسم العميل ونص الرأي مطلوبان', 'error');
  }

  db.reviews = db.reviews || [];
  db.reviews.unshift({
    id: 'rev_' + Date.now(),
    name,
    city,
    text,
    rating,
    verified: true
  });

  localStorage.setItem('awladAdminDB', JSON.stringify(db));
  renderReviews();
  document.getElementById('reviewCustomerName').value = '';
  document.getElementById('reviewCityName').value = '';
  document.getElementById('reviewTextInput').value = '';
  document.getElementById('cmsReviewRating').value = 5;
  cmsReviewStars.forEach((item) => item.classList.add('active'));
  showToast('تم حفظ رأي العميل بنجاح');
});

window.editReview = (id) => {
  const r = db.reviews.find(x => x.id === id);
  if(!r) return;
  document.getElementById('editingReviewId').value = r.id;
  document.getElementById('reviewName').value = r.name;
  document.getElementById('reviewCity').value = r.city || '';
  document.getElementById('reviewText').value = r.text;
  
  // Set stars
  currentRating = r.rating;
  stars.forEach(s => s.classList.toggle('active', parseInt(s.dataset.val) <= currentRating));
  
  document.getElementById('reviewFormTitle').textContent = 'تعديل رأي';
  document.getElementById('btnSaveReview').innerHTML = 'تحديث الرأي';
  document.getElementById('btnCancelReview').style.display = 'inline-flex';
};

window.deleteReview = (id) => {
  if(confirm('حذف هذا الرأي؟')) {
    db.reviews = db.reviews.filter(r => r.id !== id);
    renderReviews();
    showToast('تم الحذف');
  }
};

document.getElementById('btnCancelReview').addEventListener('click', resetReviewForm);

function resetReviewForm() {
  document.getElementById('editingReviewId').value = '';
  document.getElementById('reviewName').value = '';
  document.getElementById('reviewCity').value = '';
  document.getElementById('reviewText').value = '';
  currentRating = 5;
  stars.forEach(s => s.classList.add('active'));
  document.getElementById('reviewFormTitle').textContent = 'إضافة رأي جديد';
  document.getElementById('btnSaveReview').innerHTML = 'إضافة الرأي';
  document.getElementById('btnCancelReview').style.display = 'none';
}

// ==========================================
// 8. GLOBAL SAVE (SAVE ALL TO DB)
// ==========================================
document.getElementById('btnSaveAll').addEventListener('click', () => {
  // Grab Hero
  db.hero.prefix = document.getElementById('heroPrefixText').value;
  db.hero.mainTitle = document.getElementById('heroMainTitle').value;
  db.hero.suffix = document.getElementById('heroSuffixText').value;
  db.hero.subtext = document.getElementById('heroSubtext').value;
  db.hero.cta1 = document.getElementById('heroCta1Text').value;
  db.hero.cta2 = document.getElementById('heroCta2Text').value;
  
  // Grab Announcement
  db.announcement.active = document.getElementById('announcementToggle').checked;
  db.announcement.text = document.getElementById('announcementText').value;
  db.announcement.bgColor = document.getElementById('announcementBgColor').value;
  db.announcement.textColor = document.getElementById('announcementTextColor').value;
  
  // Grab Contact
  db.contact.whatsapp = document.getElementById('contactWhatsapp').value;
  db.contact.phone = document.getElementById('contactPhone').value;
  db.contact.address = document.getElementById('contactAddress').value;
  db.contact.maps = document.getElementById('contactMapsUrl').value;
  db.contact.facebook = document.getElementById('socialFacebook').value;
  db.contact.instagram = document.getElementById('socialInstagram').value;
  db.contact.youtube = document.getElementById('socialYoutube').value;
  db.contact.tiktok = document.getElementById('socialTiktok').value;

  db.roles.currentRole = document.getElementById('adminCurrentRole').value;
  db.roles.financeVisible = document.getElementById('financeVisibilityToggle').checked;

  db.platform.brandName = document.getElementById('adminBrandName').value.trim() || 'أولاد القاضي | لوحة الإدارة';
  db.platform.logo = document.getElementById('adminLogoData').value || db.platform.logo;

  db.cms.storeName = document.getElementById('footerStoreName').value.trim();
  db.cms.footerText = document.getElementById('footerCopyright').value.trim();
  db.cms.footerEmail = document.getElementById('footerEmail').value.trim();
  db.cms.footerPhone = document.getElementById('footerPhone').value.trim();
  
  // Write to Storage
  localStorage.setItem('awladAdminDB', JSON.stringify(db));
  showToast('تم حفظ جميع التغييرات بنجاح! 💾');
});

// START
loadData();

});
