/* admin.js - Awlad El-Kady Admin Dashboard Full Functional UI Engine */

const ADMIN_ALLOWED_SOCIAL_SCHEMES = /^(https?:|tel:|mailto:)/i;
let protectedSystemsStarted = false;

function safeText(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char]));
}

function readableError(error, fallback = 'حدث خطأ غير متوقع.') {
    const raw = String(error?.message || '').replace(/\s+/g, ' ').trim();
    if (!raw) return fallback;
    const withoutPrefix = raw.replace(/^\[[^\]]+\]\s*/, '');
    try {
        const parsed = JSON.parse(withoutPrefix);
        if (parsed?.error) return String(parsed.error).slice(0, 240);
        if (parsed?.message) return String(parsed.message).slice(0, 240);
    } catch (_) { /* keep plain message */ }
    return withoutPrefix.slice(0, 240);
}

function normalizeProduct(p) {
    return {
        id: p.id, name: p.name || '', sku: p.sku || '', price: Number(p.price) || 0,
        salePrice: p.sale_price == null ? null : Number(p.sale_price), stock: Number(p.stock) || 0,
        stockThreshold: Number(p.stock_threshold) || 5, bostaSize: Number(p.bosta_size) || 0,
        category: p.category || '', category_ids: p.category_ids || [], category_names: p.category_names || [],
        is_active: p.is_active !== false, bestseller: p.is_bestseller === true,
        desc: p.description || '', images: Array.isArray(p.images) ? p.images : [],
        material: p.material || '', size: p.size || ''
    };
}

window.sb_fetch = async (table) => {
    try {
        const query = table === 'site_settings' ? 'id=eq.1' : 'order=created_at.desc';
        const data = await Supabase.select(table, query);
        if (table === 'products') return data.map(normalizeProduct);
        if (table === 'orders') return data.map(o => ({id: String(o.id), status: o.status, date: new Date(o.created_at).toLocaleDateString('ar-EG'), name: o.customer_name, phone: o.customer_phone, secondPhone: o.customer_second_phone, gov: o.governorate, area: o.area, address: o.address, subtotal: Number(o.subtotal) || 0, shipping: Number(o.shipping_fee) || 0, notes: o.notes, items: Array.isArray(o.items) ? o.items : [], tracking_number: o.bosta_tracking_number || o.tracking_number || '—', bosta_status: o.bosta_status || null, bosta_delivery_id: o.bosta_delivery_id || null}));
        if (table === 'order_customer_requests') return data.map(r => ({ id: String(r.id), orderId: String(r.order_id), type: r.request_type, reason: r.reason || '', changes: r.requested_changes && typeof r.requested_changes === 'object' ? r.requested_changes : {}, status: r.status || 'pending', createdAt: new Date(r.created_at).toLocaleString('ar-EG'), adminNote: r.admin_note || '' }));
        if (table === 'complaints') return data.map(c => ({id: c.id, client: c.customer_name || '', phone: c.customer_phone || '', date: new Date(c.created_at).toLocaleDateString('ar-EG'), status: c.status || 'new', text: c.message || ''}));
        if (table === 'site_settings') return data.length ? [{...data[0], id: data[0].id}] : [];
        if (table === 'categories') return data.map(c => ({...c, desc: c.desc || c.description || ''}));
        if (table === 'faqs' || table === 'socials') return data.map(d => ({...d, visible: d.is_visible !== false}));
        return data;
    } catch(e) { console.error('[Admin fetch]', e); throw e; }
};

window.sb_insert = async (table, data) => {
    let payload = data;
    if (table === 'products') payload = {name: data.name, sku: data.sku || '', price: Number(data.price) || 0, sale_price: data.salePrice ? Number(data.salePrice) : null, stock: Number(data.stock) || 0, stock_threshold: Number(data.stockThreshold) || 5, bosta_size: Number(data.bostaSize) || 0, is_bestseller: !!data.bestseller, description: data.desc || '', images: data.images || [], is_active: true};
    if (table === 'categories') payload = {name: data.name, desc: data.desc || '', is_visible: data.is_visible !== false, sort_order: Number(data.sort_order) || 1};
    if (table === 'faqs') payload = {q: data.q, a: data.a, is_visible: data.visible !== false, sort_order: Number(data.sort_order) || 1};
    if (table === 'socials') payload = {name: data.name, icon: data.icon || 'fa-solid fa-link', link: data.link, is_visible: data.visible !== false, sort_order: Number(data.sort_order) || 1};
    return Supabase.insertReturn(table, payload);
};

window.sb_update = async (table, id, data) => {
    let payload = data;
    if (table === 'products') payload = {name: data.name, sku: data.sku || '', price: Number(data.price) || 0, sale_price: data.salePrice ? Number(data.salePrice) : null, stock: Number(data.stock) || 0, stock_threshold: Number(data.stockThreshold) || 5, bosta_size: Number(data.bostaSize) || 0, is_bestseller: !!data.bestseller, description: data.desc || '', images: data.images || []};
    if (table === 'products_visibility') { await Supabase.update('products', id, {is_active: data.is_active}); return true; }
    if (table === 'categories') payload = {name: data.name, desc: data.desc || '', is_visible: data.is_visible !== false};
    if (table === 'complaints') payload = {status: data.status};
    if (table === 'faqs' || table === 'socials') payload = {is_visible: data.visible};
    await Supabase.update(table, id, payload);
    return true;
};

window.sb_delete = async (table, id) => Supabase.delete(table, id);
window.sb_upload = async (file) => Supabase.upload(file);document.addEventListener('DOMContentLoaded', () => {
    initPasswordAuth();
    initDateBadge();
    initNavigation();
    initAswanShippingCalc();
    initSettingsScopes();
    initAdminSettings();
    initOverview();
    initBostaPickupControl();
});

// ==========================================
// 1. PIN PASSWORD AUTHENTICATION
// ==========================================
function initPasswordAuth() {
    const loginForm = document.getElementById('login-form');
    const loginScreen = document.getElementById('login-screen');
    const pwdInput = document.getElementById('password-only');
    const staffPhoneInput = document.getElementById('staff-phone-login');
    const loginError = document.getElementById('login-error');
    const dashboard = document.getElementById('dashboard');

    if (loginForm && loginScreen) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = pwdInput ? pwdInput.value : '';
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (!password) return;
            if (submitBtn) submitBtn.disabled = true;
            try {
                const staffPhone = staffPhoneInput?.value?.trim() || '';
                const response = await fetch(staffPhone ? '/api/admin-staff-auth' : '/api/admin-auth', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', body: JSON.stringify(staffPhone ? { phone: staffPhone, password } : { password })
                });
                let details = {};
                try { details = await response.json(); } catch (_) { /* non-JSON response */ }
                if (!response.ok) {
                    const error = new Error(details.error || 'Authentication failed');
                    error.status = response.status;
                    throw error;
                }
                loginScreen.classList.add('unlocked');
                dashboard.classList.remove('hidden');
                await hydrateAdminSession();
                await startProtectedSystems();
            } catch (error) {
                loginError.textContent = error.status === 503
                    ? 'تسجيل الدخول غير مهيأ على الخادم. تحقق من متغيرات Vercel السرية.'
                    : error.status === 403
                        ? 'الحساب غير مصرح له كمدير.'
                        : 'كلمة المرور غير صحيحة.';
                if (pwdInput) { pwdInput.value = ''; pwdInput.focus(); }
                if (staffPhoneInput) staffPhoneInput.value = '';
                console.error('[admin-auth]', error.status || 'network', error.message);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/admin-logout', { method: 'POST', credentials: 'include' });
            loginScreen.classList.remove('unlocked');
            dashboard.classList.add('hidden');
            if (pwdInput) pwdInput.value = '';
            if (staffPhoneInput) staffPhoneInput.value = '';
            if (loginError) loginError.textContent = '';
        });
        window.adminFetch('/api/admin-check').then(async response => {
            if (response.ok) {
                window.ADMIN_SESSION = await response.json();
                applySessionPermissions();
                loginScreen.classList.add('unlocked');
                dashboard.classList.remove('hidden');
                startProtectedSystems();
            }
        }).catch(() => {});
    }
}

let staffManagementStarted = false;
window.ADMIN_SESSION = window.ADMIN_SESSION || null;
window.staffCache = [];

function can(permission) {
    const session = window.ADMIN_SESSION || {};
    return session.owner === true || session.permissions?.['*'] === true || session.permissions?.[permission] === true;
}

function applySessionPermissions() {
    const session = window.ADMIN_SESSION || {};
    const navPermissions = { orders: 'orders.view', products: 'products.view', categories: 'categories.view', complaints: 'complaints.view', settings: 'landing.view' };
    document.querySelectorAll('.nav-item[data-target]').forEach(item => {
        const permission = navPermissions[item.dataset.target];
        if (permission) item.hidden = !can(permission);
    });
    const panel = document.getElementById('staff-management-panel');
    if (panel) panel.hidden = session.owner !== true;
    if (session.owner === true) initStaffManagement();
    initBostaPickupControl();
}

async function hydrateAdminSession() {
    try {
        const response = await window.adminFetch('/api/admin-check');
        if (!response.ok) throw new Error('SESSION_FAILED');
        window.ADMIN_SESSION = await response.json();
        applySessionPermissions();
    } catch (error) {
        console.error('[admin-session]', error);
    }
}

function staffPermissionsFromForm() {
    const permissions = {};
    document.querySelectorAll('[data-staff-permission]').forEach(input => { if (input.checked) permissions[input.dataset.staffPermission] = true; });
    return permissions;
}

function fillStaffPermissions(permissions = {}) {
    document.querySelectorAll('[data-staff-permission]').forEach(input => { input.checked = permissions[input.dataset.staffPermission] === true; });
}

function resetStaffForm() {
    const form = document.getElementById('staff-form');
    form?.reset();
    const id = document.getElementById('staff-id'); if (id) id.value = '';
    const active = document.getElementById('staff-active'); if (active) active.checked = true;
    const sessionEnabled = document.getElementById('staff-session-enabled'); if (sessionEnabled) sessionEnabled.checked = true;
    const sessionMinutes = document.getElementById('staff-session-minutes'); if (sessionMinutes) sessionMinutes.value = '60';
    fillStaffPermissions({});
}

window.editStaff = function(id) {
    const staff = window.staffCache.find(row => String(row.id) === String(id));
    if (!staff) return;
    document.getElementById('staff-id').value = staff.id;
    document.getElementById('staff-phone').value = staff.phone || '';
    document.getElementById('staff-phone').disabled = true;
    document.getElementById('staff-name').value = staff.display_name || '';
    document.getElementById('staff-password').value = '';
    document.getElementById('staff-active').checked = staff.is_active !== false;
    document.getElementById('staff-session-enabled').checked = staff.session_enabled !== false;
    document.getElementById('staff-session-minutes').value = staff.session_minutes || 60;
    fillStaffPermissions(staff.permissions || {});
    document.getElementById('staff-management-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.toggleStaff = async function(id, active) {
    const response = await window.adminFetch(`/api/admin-staff?id=${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: active }) });
    if (!response.ok) return alert('تعذر تغيير حالة الموظف.');
    await loadStaffList();
};

window.deleteStaffAccount = async function(id) {
    if (window.ADMIN_SESSION?.owner !== true) return alert('حذف الموظف متاح للمالك فقط.');
    const staff = window.staffCache.find(row => String(row.id) === String(id));
    const name = staff?.display_name || 'هذا الموظف';
    if (!window.confirm(`تأكيد حذف الموظف «${name}» نهائياً؟ سيتم إلغاء حساب دخوله وحذف سجله من القائمة.`)) return;
    const response = await window.adminFetch(`/api/admin-staff?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!response.ok) {
        let data = {}; try { data = await response.json(); } catch (_) {}
        return alert(staffOperationMessage(data));
    }
    if (String(document.getElementById('staff-id')?.value || '') === String(id)) {
        resetStaffForm();
        document.getElementById('staff-phone').disabled = false;
    }
    await loadStaffList();
};

function renderStaffList(rows) {
    const target = document.getElementById('staff-list');
    if (!target) return;
    if (!rows.length) { target.innerHTML = '<p class="text-subtle">لا يوجد موظفون مضافون حالياً.</p>'; return; }
    target.innerHTML = `<div class="table-responsive"><table class="data-table"><thead><tr><th>الاسم</th><th>الموبايل</th><th>الحالة</th><th>الجلسة</th><th>إجراء</th></tr></thead><tbody>${rows.map(row => `<tr><td>${safeText(row.display_name)}</td><td dir="ltr">${safeText(row.phone)}</td><td>${row.is_active === false ? '<span class="status-badge status-danger">موقوف</span>' : '<span class="status-badge status-success">نشط</span>'}</td><td>${row.session_enabled === false ? 'جلسة ممتدة (تجديد تلقائي)' : `${Number(row.session_minutes) || 60} دقيقة`}</td><td><button class="btn btn-secondary btn-sm" type="button" onclick="editStaff('${safeText(row.id)}')">تعديل</button><button class="btn btn-secondary btn-sm" type="button" onclick="toggleStaff('${safeText(row.id)}', ${row.is_active === false})">${row.is_active === false ? 'تفعيل' : 'إيقاف'}</button><button class="btn btn-danger btn-sm" type="button" onclick="deleteStaffAccount('${safeText(row.id)}')">حذف نهائي</button></td></tr>`).join('')}</tbody></table></div>`;
}

function staffOperationMessage(data = {}) {
    const value = String(data.error || '').trim();
    const messages = {
        INVALID_PHONE: 'رقم موبايل الموظف غير صحيح. استخدم رقم مصري من 11 رقم.',
        INVALID_PASSWORD: 'كلمة السر لازم تكون من 8 إلى 128 حرفاً.',
        INVALID_NAME: 'اكتب اسم الموظف.',
        STAFF_EXISTS: 'يوجد موظف مسجل بهذا الرقم بالفعل.',
        INVALID_SESSION_MINUTES: 'مدة الجلسة لازم تكون بين 15 دقيقة و30 يوم.',
        STAFF_RECORD_CREATE_FAILED: 'تم إنشاء حساب الدخول ولم يكتمل سجل الموظف؛ أعد المحاولة بعد مراجعة Migration الموظفين.',
        'جدول الموظفين غير محدث في Supabase؛ نفّذ Migration الموظفين ثم أعد المحاولة.': 'جدول الموظفين غير محدث في Supabase؛ نفّذ Migration الموظفين ثم أعد المحاولة.'
    };
    return messages[value] || value || 'تعذر تنفيذ عملية الموظف حالياً. راجع إعدادات Supabase أو أعد المحاولة.';
}

async function loadStaffList() {
    const target = document.getElementById('staff-list');
    if (!target || window.ADMIN_SESSION?.owner !== true) return;
    try {
        const response = await window.adminFetch('/api/admin-staff');
        if (!response.ok) throw new Error('STAFF_LIST_FAILED');
        window.staffCache = await response.json();
        renderStaffList(window.staffCache);
    } catch (error) {
        target.innerHTML = '<p class="text-danger">تعذر تحميل الموظفين.</p>';
        console.error('[staff-list]', error);
    }
}

function initStaffManagement() {
    if (staffManagementStarted) return;
    staffManagementStarted = true;
    const form = document.getElementById('staff-form');
    const staffPassword = document.getElementById('staff-password');
    const staffPasswordToggle = document.getElementById('toggle-staff-password');
    if (staffPassword && staffPasswordToggle && staffPasswordToggle.dataset.bound !== '1') {
        staffPasswordToggle.addEventListener('click', () => {
            const visible = staffPassword.type === 'text';
            staffPassword.type = visible ? 'password' : 'text';
            const icon = staffPasswordToggle.querySelector('i');
            icon?.classList.toggle('fa-eye', visible);
            icon?.classList.toggle('fa-eye-slash', !visible);
            staffPasswordToggle.title = visible ? 'إظهار كلمة المرور' : 'إخفاء كلمة المرور';
            staffPasswordToggle.setAttribute('aria-label', visible ? 'إظهار كلمة مرور الموظف' : 'إخفاء كلمة مرور الموظف');
        });
        staffPasswordToggle.dataset.bound = '1';
    }
    document.getElementById('staff-reset-btn')?.addEventListener('click', () => { resetStaffForm(); document.getElementById('staff-phone').disabled = false; });
    document.getElementById('apply-staff-global-session')?.addEventListener('click', async () => {
        const enabled = document.getElementById('staff-global-session-enabled')?.checked;
        const minutes = Number(document.getElementById('staff-global-session-minutes')?.value) || 60;
        if (minutes < 15 || minutes > 43200) return alert('المدة لازم تكون بين 15 دقيقة و30 يوم.');
        const response = await window.adminFetch('/api/admin-staff?scope=all', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_enabled: enabled, session_minutes: minutes }) });
        if (!response.ok) return alert('تعذر تطبيق إعداد الجلسة على الموظفين.');
        await loadStaffList();
        alert('تم تطبيق إعداد الجلسة على كل الموظفين.');
    });
    form?.addEventListener('submit', async event => {
        event.preventDefault();
        const id = document.getElementById('staff-id')?.value;
        const payload = { phone: document.getElementById('staff-phone')?.value, display_name: document.getElementById('staff-name')?.value, password: document.getElementById('staff-password')?.value, is_active: document.getElementById('staff-active')?.checked, session_enabled: document.getElementById('staff-session-enabled')?.checked, session_minutes: Number(document.getElementById('staff-session-minutes')?.value) || 60, permissions: staffPermissionsFromForm() };
        if (id && !payload.password) delete payload.password;
        const response = await window.adminFetch(id ? `/api/admin-staff?id=${encodeURIComponent(id)}` : '/api/admin-staff', { method: id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) { let data = {}; try { data = await response.json(); } catch (_) {} return alert(staffOperationMessage(data)); }
        resetStaffForm();
        document.getElementById('staff-phone').disabled = false;
        await loadStaffList();
    });
    loadStaffList();
}

async function startProtectedSystems() {
    if (protectedSystemsStarted) return;
    protectedSystemsStarted = true;
    await Promise.allSettled([initOrdersSystem(), initProductsAndCategories(), initComplaintsSystem(), initSiteSettings()]);
    await refreshDashboardData();
    setInterval(refreshDashboardData, 30000);
}

// ==========================================
// 2. DATE DISPLAY
// ==========================================
function initDateBadge() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const options = { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' };
        dateEl.textContent = new Date().toLocaleDateString('ar-EG', options);
    }
}

function initSettingsScopes() {
    const buttons = document.querySelectorAll('[data-settings-scope]');
    const panes = { landing: document.getElementById('landing-settings-pane'), admin: document.getElementById('admin-settings-pane') };
    buttons.forEach(button => button.addEventListener('click', () => {
        buttons.forEach(item => item.classList.toggle('active', item === button));
        Object.entries(panes).forEach(([key, pane]) => pane?.classList.toggle('hidden', key !== button.dataset.settingsScope));
    }));
}

function initAdminSettings() {
    const key = 'awlad_admin_preferences';
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(key) || '{}'); } catch (_) {}
    const minutes = document.getElementById('admin-session-minutes');
    const pageSize = document.getElementById('admin-page-size');
    const showCalc = document.getElementById('admin-show-shipping-calc');
    const enableExcel = document.getElementById('admin-enable-excel');
    if (minutes) minutes.value = saved.sessionMinutes || 60;
    if (pageSize) pageSize.value = saved.pageSize || 12;
    if (showCalc) showCalc.checked = saved.showShippingCalc !== false;
    if (enableExcel) enableExcel.checked = saved.enableExcel !== false;
    const apply = () => {
        const calc = document.getElementById('open-shipping-calc');
        const excel = document.getElementById('export-bosta-btn');
        if (calc && showCalc) calc.hidden = !showCalc.checked;
        if (excel && enableExcel) excel.hidden = !enableExcel.checked;
    };
    apply();
    document.getElementById('save-admin-settings-btn')?.addEventListener('click', () => {
        const prefs = { sessionMinutes: Number(minutes?.value) || 60, pageSize: Number(pageSize?.value) || 12, showShippingCalc: !!showCalc?.checked, enableExcel: !!enableExcel?.checked };
        localStorage.setItem(key, JSON.stringify(prefs));
        apply();
        alert('تم حفظ إعدادات اللوحة بنجاح.');
    });
}

async function refreshDashboardData() {
    if (document.querySelector('.modal-overlay:not(.hidden)')) return;
    try {
        const [orders, complaints, products, categories, links] = await Promise.all([
            sb_fetch('orders'), sb_fetch('complaints'), sb_fetch('products'), sb_fetch('categories'), Supabase.select('product_categories').catch(() => [])
        ]);
        sampleOrders = orders || [];
        sampleComplaints = complaints || [];
        sampleCategories = categories || [];
        sampleProducts = attachProductCategories(products || [], links || []);
        if (document.getElementById('view-orders')?.classList.contains('active')) renderOrders(sampleOrders);
        if (document.getElementById('view-complaints')?.classList.contains('active')) renderComplaints(sampleComplaints);
        if (document.getElementById('view-products')?.classList.contains('active')) renderProducts(sampleProducts);
        if (document.getElementById('view-categories')?.classList.contains('active')) renderCategories(sampleCategories);
        populateCategoryDropdowns();
        updateOverviewStats();
    } catch (error) { console.error('[dashboard sync]', error); }
}

function attachProductCategories(products, links) {
    const map = new Map();
    (links || []).forEach(link => {
        const id = Number(link.product_id);
        if (!map.has(id)) map.set(id, []);
        map.get(id).push(Number(link.category_id));
    });
    return (products || []).map(product => ({ ...product, category_ids: map.get(Number(product.id)) || [] }));
}

function initOverview() { updateOverviewStats(); }
function updateOverviewStats() {
    const newOrders = sampleOrders.filter(order => ['جديد', 'new'].includes(order.status)).length;
    const openComplaints = sampleComplaints.filter(item => !['resolved', 'تم الحل', 'closed'].includes(item.status)).length;
    const lowStock = sampleProducts.filter(item => Number(item.stock) <= Number(item.stockThreshold || 5)).length;
    const values = { 'stat-new-orders': newOrders, 'stat-products': sampleProducts.length, 'stat-categories': sampleCategories.length, 'stat-open-complaints': openComplaints, 'stat-low-stock': lowStock };
    Object.entries(values).forEach(([id, value]) => { const el = document.getElementById(id); if (el) el.textContent = value; });
}

// ==========================================
// 3. MAIN NAVIGATION & SUBTABS
// ==========================================
function initNavigation() {
    const navItems = document.querySelectorAll('.sidebar .nav-item');
    const viewPanes = document.querySelectorAll('.view-pane');
    const pageTitle = document.getElementById('page-title');
    const sidebar = document.querySelector('.sidebar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(n => n.classList.remove('active'));
            item.classList.add('active');

            const target = item.getAttribute('data-target');
            if (target) {
                viewPanes.forEach(p => p.classList.remove('active'));
                const activePane = document.getElementById('view-' + target);
                if (activePane) {
                    activePane.classList.add('active');
                    const titleText = item.querySelector('span');
                    if (pageTitle && titleText) pageTitle.textContent = titleText.textContent;
                }
                if (window.innerWidth <= 768 && sidebar) sidebar.classList.remove('open');
            }
        });
    });

    if (mobileMenuBtn && sidebar) {
        mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    }

    // Products / Categories Subtabs
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    const subtabContents = document.querySelectorAll('.subtab-content');
    subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            subTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.getAttribute('data-subtab');
            if (target) {
                subtabContents.forEach(c => c.classList.remove('active'));
                const activeContent = document.getElementById(target);
                if (activeContent) activeContent.classList.add('active');
            }
        });
    });

    // Password Toggle Logic
    const togglePasswordBtn = document.getElementById('toggle-password');
    const passwordInput = document.getElementById('password-only');
    const toggleIcon = document.getElementById('toggle-password-icon');
    if (togglePasswordBtn && passwordInput && toggleIcon) {
        togglePasswordBtn.addEventListener('click', () => {
            if (passwordInput.type === 'password') {
                passwordInput.type = 'text';
                toggleIcon.classList.remove('fa-eye');
                toggleIcon.classList.add('fa-eye-slash');
            } else {
                passwordInput.type = 'password';
                toggleIcon.classList.remove('fa-eye-slash');
                toggleIcon.classList.add('fa-eye');
            }
        });
    }

    // Settings Sidebar Subtabs
    const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
    const tabContentItems = document.querySelectorAll('.tab-content-item');
    settingsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.getAttribute('data-tab');
            if (target) {
                tabContentItems.forEach(t => t.classList.remove('active'));
                const activeTab = document.getElementById(target);
                if (activeTab) activeTab.classList.add('active');
            }
        });
    });
}

// ==========================================
// 4. FLOATING ASWAN BOSTA CONTRACT SHIPPING CALCULATOR
// ==========================================
function initAswanShippingCalc() {
    const calcBtn = document.getElementById('open-shipping-calc');
    const closeCalcBtn = document.getElementById('close-shipping-calc');
    const calcSidebar = document.getElementById('shipping-sidebar');

    if (calcBtn && calcSidebar) calcBtn.addEventListener('click', () => calcSidebar.classList.add('open'));
    if (closeCalcBtn && calcSidebar) closeCalcBtn.addEventListener('click', () => calcSidebar.classList.remove('open'));

    const calcBostaSizeSelect = document.getElementById('calc-bosta-size-select');
    const calcServiceType = document.getElementById('calc-service-type');

    const basePriceEl = document.getElementById('calc-base-price');
    const vatAmountEl = document.getElementById('calc-vat-amount');
    const totalFinalEl = document.getElementById('calc-total-final');

    function calculateShipping() {
        if (!calcBostaSizeSelect) return;
        const baseRate = parseFloat(calcBostaSizeSelect.value) || 140;
        const service = calcServiceType ? calcServiceType.value : 'delivery';

        let rateMultiplier = 1;
        if (service === 'exchange') rateMultiplier = 1.1; // +10 EGP exchange rate
        if (service === 'return') rateMultiplier = 1.05;

        const subtotal = baseRate * rateMultiplier;
        const vat = subtotal * 0.14;
        const total = subtotal + vat;

        if (basePriceEl) basePriceEl.textContent = subtotal.toFixed(2) + ' ج.م';
        if (vatAmountEl) vatAmountEl.textContent = vat.toFixed(2) + ' ج.م';
        if (totalFinalEl) totalFinalEl.textContent = total.toFixed(2) + ' ج.م';
    }

    if (calcBostaSizeSelect) calcBostaSizeSelect.addEventListener('change', calculateShipping);
    if (calcServiceType) calcServiceType.addEventListener('change', calculateShipping);
    calculateShipping();
}

// ==========================================
// 5. ORDERS SYSTEM & EXACT BOSTA EXCEL EXPORT (V3.5)
// ==========================================
let sampleOrders = [];
let customerRequests = [];
let sampleProducts = [];
let sampleCategories = [];

async function initOrdersSystem() {
    const [orders, requests] = await Promise.all([sb_fetch('orders'), sb_fetch('order_customer_requests').catch(() => [])]);
    sampleOrders = orders || [];
    customerRequests = requests || [];
    renderCustomerRequests(customerRequests);
    renderOrders(sampleOrders);

    // Search filter
    const searchInput = document.getElementById('search-orders-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = sampleOrders.filter(o => {
                const values = [o.id, o.name, o.phone, o.gov]
                    .map(value => String(value || '').toLowerCase());
                return values.some(value => value.includes(query));
            });
            renderOrders(filtered);
        });
    }

    // Filter Buttons
    const filterAll = document.getElementById('filter-all-orders');
    const filterNew = document.getElementById('filter-new-orders');
    if (filterAll) filterAll.addEventListener('click', () => {
        filterAll.classList.add('active-filter');
        if (filterNew) filterNew.classList.remove('active-filter');
        renderOrders(sampleOrders);
    });
    if (filterNew) filterNew.addEventListener('click', () => {
        filterNew.classList.add('active-filter');
        if (filterAll) filterAll.classList.remove('active-filter');
        renderOrders(sampleOrders.filter(o => o.status === 'جديد'));
    });

    // Bosta Batch Excel Export (Strict Bosta Template V3.5 Format)
    const exportBtn = document.getElementById('export-bosta-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (typeof XLSX === 'undefined') {
                alert('مكتبة Excel قيد التحميل، يرجى المحاولة بعد لحظات...');
                return;
            }

            // Columns matching Bosta Template V3.5 AR
            const excelHeader = [
                '* Name',
                '* Phone',
                'Second Phone',
                '* City',
                'Area *',
                '* Street Name',
                '* Cash Amount',
                'Delivery Notes',
                'Package Description',
                'Type',
                'No of Items',
                'Allow Opening Package?',
                'Order Reference'
            ];

            const excelRows = sampleOrders.map(o => [
                o.name,                                     // * Name
                o.phone,                                    // * Phone
                o.secondPhone || '',                        // Second Phone
                o.gov,                                      // * City
                o.area,                                     // Area *
                o.address,                                  // * Street Name
                ((o.subtotal || 0) + (o.shipping || 0)).toFixed(2), // * Cash Amount
                o.notes || 'عقد أسوان',                     // Delivery Notes
                o.items.map(i => i.name).join(' + '),       // Package Description
                'Deliver',                                  // Type
                o.items.reduce((acc, i) => acc + (i.qty || 1), 0), // No of Items
                'Yes',                                      // Allow Opening Package?
                o.id                                        // Order Reference
            ]);

            const wsData = [excelHeader, ...excelRows];
            const ws = XLSX.utils.aoa_to_sheet(wsData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Bosta_Upload");
            XLSX.writeFile(wb, `bosta_orders_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        });
    }
}

function renderCustomerRequests(requests = []) {
    const panel = document.getElementById('customer-requests-panel');
    const container = document.getElementById('customer-requests-container');
    const count = document.getElementById('customer-requests-count');
    if (!panel || !container) return;
    const pendingCount = requests.filter(request => request.status === 'pending').length;
    panel.hidden = !requests.length;
    if (count) count.textContent = `${pendingCount} معلّق`;
    if (!requests.length) { container.innerHTML = ''; return; }
    const orderById = new Map(sampleOrders.map(order => [String(order.id), order]));
    container.innerHTML = requests.slice(0, 40).map(request => {
        const order = orderById.get(String(request.orderId));
        const typeLabel = request.type === 'cancel' ? 'طلب إلغاء' : 'طلب تعديل بيانات التوصيل';
        const statusLabel = request.status === 'pending' ? 'قيد المراجعة' : request.status === 'applied' ? 'تم التنفيذ' : 'تم الرفض';
        const changeLabels = { customer_name: 'الاسم', customer_phone: 'الموبايل', governorate: 'المحافظة', area: 'المنطقة', address: 'العنوان', notes: 'الملاحظات' };
        const changes = Object.entries(request.changes || {}).map(([key, value]) => `<div><strong>${safeText(changeLabels[key] || key)}:</strong> ${safeText(value)}</div>`).join('');
        const controls = request.status === 'pending' && can('orders.update_status') ? `<div class="customer-request-actions"><input id="request-note-${safeText(request.id)}" class="form-control" placeholder="ملاحظة داخلية اختيارية" maxlength="500"><button class="btn btn-primary btn-sm" onclick="reviewCustomerRequest('${safeText(request.id)}','approve')">قبول وتنفيذ</button><button class="btn btn-danger btn-sm" onclick="reviewCustomerRequest('${safeText(request.id)}','reject')">رفض</button></div>` : '';
        return `<article class="customer-request-card"><div class="customer-request-header"><strong>${safeText(typeLabel)} — طلب #${safeText(request.orderId)}</strong><span class="badge ${request.status === 'pending' ? 'badge-new' : 'badge-process'}">${safeText(statusLabel)}</span></div><div class="customer-request-meta">${safeText(request.createdAt)}${order?.name ? ` · ${safeText(order.name)}` : ''}${order?.phone ? ` · ${safeText(order.phone)}` : ''}</div><p><strong>السبب:</strong> ${safeText(request.reason)}</p>${changes ? `<div class="customer-request-changes"><strong>التعديل المطلوب:</strong>${changes}</div>` : ''}${order?.tracking_number && order.tracking_number !== '—' ? `<p class="text-danger text-sm">يوجد رقم تتبع Bosta: ${safeText(order.tracking_number)} — لا يتم التعديل أو الإلغاء تلقائياً.</p>` : ''}${controls}</article>`;
    }).join('');
}

window.reviewCustomerRequest = async function(requestId, decision) {
    const note = document.getElementById(`request-note-${requestId}`)?.value?.trim() || '';
    try {
        const response = await window.adminFetch('/api/admin?action=review_customer_request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request_id: requestId, decision, admin_note: note }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'تعذر مراجعة طلب العميل');
        const [orders, requests] = await Promise.all([sb_fetch('orders'), sb_fetch('order_customer_requests')]);
        sampleOrders = orders || [];
        customerRequests = requests || [];
        renderCustomerRequests(customerRequests);
        renderOrders(sampleOrders);
    } catch (error) {
        alert(readableError(error, 'تعذر مراجعة طلب العميل حالياً.'));
    }
};

function renderOrders(orders) {
    const container = document.getElementById('orders-cards-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle">لا توجد طلبات مطابقة للبحث.</div>`;
        return;
    }

    container.innerHTML = orders.map((o, idx) => {
        const total = ((o.subtotal || 0) + (o.shipping || 0)).toFixed(2);
        const trackingHtml = o.tracking_number && o.tracking_number !== '—'
            ? `<span class="text-subtle text-sm block mt-1"><i class="fa-solid fa-truck"></i> بوليصة: <strong dir="ltr">${safeText(o.tracking_number)}</strong></span>`
            : o.bosta_status === 'failed'
                ? `<span class="text-danger text-sm block mt-1"><i class="fa-solid fa-triangle-exclamation"></i> فشل إنشاء بوليصة Bosta</span>`
                : `<span class="text-subtle text-sm block mt-1 opacity-50">لا يوجد رقم بوليصة حتى الآن</span>`;
        const bostaActions = o.tracking_number && o.tracking_number !== '—' ? `${can('bosta.print_awb') ? `<button class="btn btn-ghost btn-sm" onclick="printBostaAwb('${safeText(o.id)}','A4')"><i class="fa-solid fa-file-pdf"></i> طباعة AWB</button>` : ''}${can('bosta.pack') ? `<button class="btn btn-primary btn-sm" onclick="markOrderPacked('${safeText(o.id)}')"><i class="fa-solid fa-box"></i> تم التغليف</button>` : ''}` : '';

        return `
            <div class="order-card glass-panel" data-idx="${idx}">
                <div class="order-card-header">
                    <div class="flex-align gap-3">
                        <strong class="text-primary text-lg">#${o.id}</strong>
                        <span class="badge ${o.status === 'جديد' ? 'badge-new' : 'badge-process'}">${o.status}</span>
                        <span class="text-subtle text-sm"><i class="fa-regular fa-clock"></i> ${o.date}</span>
                    </div>
                    <div class="text-primary font-bold text-lg" id="order-grand-total-${idx}">${total} ج.م</div>
                </div>

                <div class="order-card-body">
                    <div>
                        <span class="text-subtle text-sm block">بيانات العميل:</span>
                        <strong class="text-dark block">${o.name}</strong>
                        <span class="text-subtle text-sm" dir="ltr">${o.phone}</span>
                        ${o.secondPhone ? `<span class="text-subtle text-sm block" dir="ltr">بديل: ${o.secondPhone}</span>` : ''}
                        ${trackingHtml}
                    </div>
                    <div>
                        <span class="text-subtle text-sm block">المحافظة:</span>
                        <strong class="text-primary block">${o.gov}${o.area ? ' - '+o.area : ''}</strong>
                        <span class="text-subtle text-sm">${o.address}</span>
                    </div>
                    <div>
                        <span class="text-subtle text-sm block">المنتجات:</span>
                        <div class="flex-column gap-1 mt-1">
                            ${o.items.map(item => `
                                <div class="bg-surface p-2 rounded text-sm flex-between">
                                    <span>${item.name||'—'} (x${item.qty||1})</span>
                                    <span class="text-subtle text-sm">SKU: ${item.sku||'—'} | ${item.price||0} ج</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <span class="text-subtle text-sm block mb-1">الشحن (تعديل يدوي):</span>
                        <div class="flex-align gap-1">
                            <input type="number" class="editable-shipping-input"
                                value="${(o.shipping||0).toFixed(2)}"
                                onchange="updateOrderShipping('${o.id}', ${idx}, this.value)">
                            <span class="text-subtle text-sm">ج.م</span>
                        </div>
                        <span class="text-subtle text-sm block mt-1" style="font-size:0.72rem;">عقد أسوان بوسطة</span>
                    </div>
                </div>

                <div class="order-card-footer">
                    <div class="flex-align gap-2 flex-wrap">
                        <button class="btn btn-ghost btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i> طباعة</button>
                        ${bostaActions}
                    </div>
                    <span class="text-subtle text-sm">فرعي: ${(o.subtotal||0).toFixed(2)} | إجمالي: <strong class="text-primary">${total} ج.م</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

function nextBostaPickupDate() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 1);
    while (date.getDay() === 5) date.setDate(date.getDate() + 1);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
}

window.requestBostaPickup = async function() {
    if (!can('bosta.request_pickup')) return alert('ليس لديك صلاحية طلب استلام المندوب.');
    const readyCount = sampleOrders.filter(row => row.tracking_number && row.tracking_number !== '—' && !['تم التسليم', 'ملغي', 'مرفوض', 'مرتجع'].includes(String(row.status || ''))).length || 1;
    const scheduledDate = window.prompt('اكتب تاريخ استلام المندوب بصيغة YYYY-MM-DD. يوم الجمعة غير مسموح.', nextBostaPickupDate());
    if (scheduledDate === null) return;
    const parcelsValue = window.prompt('عدد الطرود التي سيستلمها المندوب؟', String(readyCount));
    if (parcelsValue === null) return;
    const button = document.getElementById('request-bosta-pickup-btn');
    if (button) { button.disabled = true; button.dataset.originalText = button.textContent; button.textContent = 'جاري طلب المندوب…'; }
    try {
        const response = await window.adminFetch('/api/bosta-create-delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'request_pickup', scheduled_date: scheduledDate.trim(), number_of_parcels: Number(parcelsValue) }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر طلب استلام المندوب');
        alert(`${data.message || 'تم إرسال طلب استلام المندوب إلى Bosta.'}\nالتاريخ: ${data.scheduled_date}\nعدد الطرود: ${data.number_of_parcels}`);
    } catch (error) {
        alert(readableError(error, 'تعذر طلب استلام المندوب من Bosta حالياً.'));
    } finally {
        if (button) { button.disabled = false; button.textContent = button.dataset.originalText || 'طلب استلام المندوب'; }
    }
};

function initBostaPickupControl() {
    const button = document.getElementById('request-bosta-pickup-btn');
    if (!button) return;
    button.hidden = !can('bosta.request_pickup');
    if (button.dataset.bound === '1') return;
    button.addEventListener('click', window.requestBostaPickup);
    button.dataset.bound = '1';
}

window.printBostaAwb = async function(orderId, awbType = 'A4') {
    try {
        const response = await window.adminFetch('/api/bosta-create-delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'print_awb', order_id: orderId, awb_type: awbType }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر طباعة البوليصة');
        if (data.pdf_base64) {
            const bytes = Uint8Array.from(atob(data.pdf_base64), char => char.charCodeAt(0));
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            window.open(url, '_blank', 'noopener,noreferrer');
            setTimeout(() => URL.revokeObjectURL(url), 60000);
        } else {
            alert(data.message || 'تم إرسال طلب طباعة البوليصة إلى Bosta.');
        }
    } catch (error) {
        alert(readableError(error, 'تعذر طباعة بوليصة Bosta حالياً.'));
    }
};

window.markOrderPacked = async function(orderId) {
    try {
        const response = await window.adminFetch('/api/bosta-create-delivery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'mark_packed', order_id: orderId }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'تعذر تأكيد التغليف');
        const order = sampleOrders.find(row => String(row.id) === String(orderId));
        if (order) order.status = data.status || 'قيد التجهيز';
        renderOrders(sampleOrders);
    } catch (error) {
        alert(readableError(error, 'تعذر تأكيد التغليف حالياً.'));
    }
};

window.updateOrderShipping = async function(orderId, idx, newShippingVal) {
    const val = parseFloat(newShippingVal) || 0;
    const order = sampleOrders[idx];
    if (!order) return;
    const newTotal = (order.subtotal + val).toFixed(2);
    try {
        await Supabase.update('orders', orderId, { shipping_fee: val, total: parseFloat(newTotal) });
        sampleOrders[idx].shipping = val;
        const grandTotalEl = document.getElementById(`order-grand-total-${idx}`);
        if (grandTotalEl) grandTotalEl.textContent = newTotal + ' ج.م';
    } catch(e) { alert('خطأ حفظ الشحن: ' + e.message); }
};

// ==========================================
// 6. PRODUCTS & CATEGORIES FULL CRUD ENGINE
// ==========================================

async function initProductsAndCategories() {
    const [rawProducts, categories, links] = await Promise.all([sb_fetch('products'), sb_fetch('categories'), Supabase.select('product_categories').catch(() => [])]);
    sampleCategories = categories || [];
    sampleProducts = attachProductCategories(rawProducts || [], links || []);
    renderProducts(sampleProducts);
    renderCategories(sampleCategories);
    populateCategoryDropdowns();
    renderGalleryUploaderSlots([]);

    // Product Search
    const searchProd = document.getElementById('search-products-input');
    if (searchProd) {
        searchProd.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = sampleProducts.filter(p => {
                const values = [p.name, p.sku, p.category]
                    .map(value => String(value || '').toLowerCase());
                return values.some(value => value.includes(q));
            });
            renderProducts(filtered);
        });
    }

    // Add Product Modal Trigger
    const openAddProductModalBtn = document.getElementById('open-add-product-modal');
    const productModal = document.getElementById('product-modal');
    const productForm = document.getElementById('product-form');

    if (openAddProductModalBtn && productModal) {
        openAddProductModalBtn.addEventListener('click', () => {
            if (productForm) productForm.reset();
            document.getElementById('p-edit-id').value = '';
            document.getElementById('product-modal-title').textContent = 'إضافة منتج جديد';
            const sizeSelect = document.getElementById('p-bosta-size');
            if (sizeSelect) sizeSelect.value = '140';
            populateCategoryDropdowns();
            renderGalleryUploaderSlots([]);
            productModal.classList.remove('hidden');
        });
    }

    if (productForm) {
        productForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = productForm.querySelector('button[type="submit"]');
            const originalText = submitBtn ? submitBtn.innerHTML : 'حفظ';
            if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> أرجو الانتظار...'; }

            try {
                const editId = document.getElementById('p-edit-id')?.value;
                const name = document.getElementById('p-name')?.value?.trim();
                const sku = document.getElementById('p-sku')?.value?.trim();
                const price = parseFloat(document.getElementById('p-price')?.value);
                const saleRaw = document.getElementById('p-sale-price')?.value?.trim() || '';
                const salePrice = saleRaw === '' ? null : parseFloat(saleRaw);
                const stockVal = parseInt(document.getElementById('p-stock')?.value, 10);
                const thresholdVal = parseInt(document.getElementById('p-stock-threshold')?.value, 10);

                const categorySelect = document.getElementById('p-category-select');
                const selectedOptions = Array.from(categorySelect?.selectedOptions || []);
                const categoryIds = selectedOptions.map(option => Number(option.dataset.id)).filter(Number.isInteger);
                if (categoryIds.length && !can('categories.assign')) throw new Error('ليس لديك صلاحية ربط المنتج بالأقسام.');

                const newProd = {
                    name,
                    sku,
                    price,
                    salePrice,
                    stock: Number.isFinite(stockVal) ? stockVal : 0,
                    stockThreshold: Number.isFinite(thresholdVal) && thresholdVal >= 0 ? thresholdVal : 5,
                    bostaSize: parseFloat(document.getElementById('p-bosta-size')?.value) || 140,
                    category: selectedOptions[0]?.value || '',
                    categoryIds,
                    bestseller: document.getElementById('p-tag-bestseller')?.checked,
                    desc: document.getElementById('p-desc')?.value?.trim(),
                    images: currentEditingImages
                };
                if (!newProd.name || !newProd.sku || !Number.isFinite(newProd.price) || newProd.price < 0) throw new Error('راجع اسم المنتج وSKU والسعر.');
                if (newProd.stock < 0) throw new Error('المخزون لا يمكن أن يكون بالسالب.');
                if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice >= newProd.price)) throw new Error('سعر العرض لازم يكون أكبر من صفر وأقل من السعر الأساسي.');

                let saved;
                if (editId) saved = await sb_update('products', editId, newProd);
                else saved = await sb_insert('products', newProd);
                const savedId = editId || saved?.id;
                if (!savedId) throw new Error('الخادم لم يرجع معرف المنتج بعد الحفظ. لم يتم تأكيد الإضافة.');
                if (typeof Supabase.replaceProductCategories === 'function' && (can('categories.assign') || categoryIds.length)) {
                    await Supabase.replaceProductCategories(savedId, categoryIds);
                }

                productModal.classList.add('hidden');
                await refreshDashboardData();
                alert('تم حفظ المنتج بنجاح!');
            } catch(error) {
                alert('تعذر حفظ المنتج: ' + readableError(error, 'راجع البيانات وحاول مرة أخرى.'));
                console.error('[product save]', error);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
            }
        });
    }

    // Categories Modal & Form Triggers (FULL CRUD)
    const openAddCatBtn = document.getElementById('open-add-category-modal');
    const categoryModal = document.getElementById('category-modal');
    const categoryForm = document.getElementById('category-form');

    if (openAddCatBtn && categoryModal) {
        openAddCatBtn.addEventListener('click', () => {
            if (categoryForm) categoryForm.reset();
            document.getElementById('cat-edit-id').value = '';
            document.getElementById('cat-modal-title').textContent = 'إضافة قسم جديد';
            categoryModal.classList.remove('hidden');
        });
    }

    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = categoryForm.querySelector('button[type="submit"]');
            const originalText = submitBtn?.innerHTML || 'حفظ القسم';
            const editId = document.getElementById('cat-edit-id')?.value;
            const name = document.getElementById('cat-name')?.value?.trim();
            const desc = document.getElementById('cat-desc')?.value?.trim();
            if (!name) return alert('اكتب اسم القسم أولاً.');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'جاري الحفظ...'; }
            try {
                if (editId) await sb_update('categories', editId, {name, desc});
                else await sb_insert('categories', {name, desc});
                categoryModal.classList.add('hidden');
                await refreshDashboardData();
            } catch (error) {
                alert('تعذر حفظ القسم: ' + readableError(error, 'راجع البيانات وحاول مرة أخرى.'));
                console.error('[category save]', error);
            } finally {
                if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = originalText; }
            }
        });
    }
}

function populateCategoryDropdowns() {
    const select = document.getElementById('p-category-select');
    if (!select) return;
    select.multiple = true;
    select.innerHTML = sampleCategories.map(c => `<option value="${safeText(c.name)}" data-id="${Number(c.id)}">${safeText(c.name)}</option>`).join('');
}

function renderProducts(products) {
    const container = document.getElementById('products-cards-container');
    if (!container) return;
    if (!products || products.length === 0) {
        container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle w-full" style="grid-column:1/-1">لا توجد منتجات مضافة حتى الآن.</div>`;
        return;
    }
    container.innerHTML = products.map(p => {
        const isLowStock = p.stock <= (p.stockThreshold || 5);
        const mainImg = p.images?.find(i => i?.main)?.url || p.images?.[0]?.url || '';
        const thumbHtml = mainImg ? `<img src="${safeText(mainImg)}" alt="${safeText(p.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">` : `<i class="fa-solid fa-box-open" style="font-size:2rem;color:var(--text-subtle)"></i>`;
        const sale = Number(p.salePrice) > 0 && Number(p.salePrice) < Number(p.price) ? Number(p.salePrice) : null;
        return `<div class="product-card${p.is_active === false ? ' opacity-50' : ''}">
            <div class="product-thumb-container" style="position:relative;background:#f1f5f2;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:120px;">${thumbHtml}
                <div class="badge-overlay-container" style="position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:4px;">
                    ${!p.is_active ? '<span class="badge" style="background:#ef4444;color:#fff;">مخفي</span>' : ''}
                    ${p.bestseller ? '<span class="badge badge-resolved">الأكثر مبيعاً</span>' : ''}
                    ${isLowStock ? `<span class="badge badge-new"><i class="fa-solid fa-triangle-exclamation"></i> (${p.stock})</span>` : ''}
                </div>
            </div>
            <div class="product-card-body"><span class="text-subtle text-sm block mb-1">${safeText(p.category)}</span><strong class="text-primary font-bold text-lg mb-1">${safeText(p.name)}</strong>
                <span class="text-subtle text-sm mb-2">SKU: ${safeText(p.sku || '—')} | بوسطة: ${Number(p.bostaSize || 0)} ج</span>
                <p class="text-subtle text-sm mb-3" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${safeText(p.desc || '')}</p>
                <div class="flex-between mt-auto"><div><strong class="text-primary text-lg">${sale ?? Number(p.price || 0)} ج.م</strong>${sale ? `<span class="text-subtle text-sm" style="text-decoration:line-through;">${Number(p.price)} ج</span>` : ''}</div><span class="text-sm font-bold ${isLowStock ? 'text-danger' : 'text-emerald'}">${Number(p.stock)} قطعة</span></div>
                <div class="product-card-actions"><button class="btn btn-ghost btn-sm" onclick="editProduct(${Number(p.id)})"><i class="fa-solid fa-pen"></i> تعديل</button><button class="btn btn-ghost btn-sm" title="${p.is_active ? 'إخفاء' : 'إظهار'}" onclick="toggleProductVisibility(${Number(p.id)}, ${!p.is_active})"><i class="fa-solid ${p.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i></button><button class="btn btn-danger-ghost btn-sm" onclick="deleteProduct(${Number(p.id)})"><i class="fa-solid fa-trash"></i></button></div>
            </div></div>`;
    }).join('');
}

function renderCategories(categories) {
    const container = document.getElementById('categories-cards-container');
    if (!container) return;
    if (!categories || categories.length === 0) { container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle w-full" style="grid-column:1/-1">لا توجد أقسام مضافة حتى الآن.</div>`; return; }
    container.innerHTML = categories.map(c => `<div class="category-card glass-panel"><div><strong class="text-primary block font-bold text-lg">${safeText(c.name)}</strong><span class="text-subtle text-sm">${safeText(c.desc || c.description || '')}</span></div><div class="flex-align gap-2"><button class="btn btn-ghost btn-sm" onclick="editCategory(${Number(c.id)})"><i class="fa-solid fa-pen"></i></button><button class="btn btn-danger-ghost btn-sm" onclick="deleteCategory(${Number(c.id)})"><i class="fa-solid fa-trash"></i></button></div></div>`).join('');
}

// 6 Image Slots Uploader State & Logic
let currentEditingImages = [];

function renderGalleryUploaderSlots(existingImages) {
    currentEditingImages = (existingImages || []).filter(img => img && img.url);
    const galleryContainer = document.getElementById('product-images-gallery');
    if (!galleryContainer) return;

    let html = '';
    // Render existing valid images
    currentEditingImages.forEach((imgObj, i) => {
        const isMain = imgObj.main;
        html += `
            <div class="img-box ${isMain ? 'main-box' : ''}" onclick="setMainImageSlot(${i})">
                ${isMain ? '<span class="main-badge">رئيسية</span>' : ''}
                <button type="button" class="remove-img-btn" onclick="event.stopPropagation(); removeImageSlot(${i})"><i class="fa-solid fa-xmark"></i></button>
                <img src="${imgObj.url}" class="img-preview" alt="صورة ${i+1}">
            </div>
        `;
    });

    // Render 1 extra slot for uploading a new image
    const nextIndex = currentEditingImages.length;
    html += `
        <div class="img-box" onclick="document.getElementById('img-upload-slot-new').click()">
            <i class="fa-solid fa-plus"></i>
            <span>إضافة صورة</span>
            <input type="file" id="img-upload-slot-new" class="img-file-input" accept="image/*" style="display:none;" onchange="handleImageSlotUpload(event, ${nextIndex})">
        </div>
    `;

    galleryContainer.innerHTML = html;
}

window.handleImageSlotUpload = async function(event, index) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const url = await sb_upload(file);
        let isMain = false;
        if (currentEditingImages.length === 0) isMain = true;
        currentEditingImages.push({ url, main: isMain });
        renderGalleryUploaderSlots(currentEditingImages);
    } catch (e) {
        alert('تعذر رفع الصورة: ' + readableError(e, 'تحقق من نوع وحجم الصورة وصلاحيات الحساب.'));
        console.error('[image upload]', e);
    }
};

window.setMainImageSlot = function(index) {
    currentEditingImages.forEach((img, idx) => {
        if (img) img.main = (idx === index);
    });
    renderGalleryUploaderSlots(currentEditingImages);
};

window.removeImageSlot = function(index) {
    currentEditingImages.splice(index, 1);
    renderGalleryUploaderSlots(currentEditingImages);
};

window.editProduct = function(id) {
    const prod = sampleProducts.find(p => p.id === id);
    if (!prod) return;

    populateCategoryDropdowns();
    document.getElementById('p-edit-id').value = prod.id;
    document.getElementById('p-name').value = prod.name;
    document.getElementById('p-sku').value = prod.sku;
    document.getElementById('p-price').value = prod.price;
    document.getElementById('p-sale-price').value = prod.salePrice || '';
    document.getElementById('p-stock').value = prod.stock;
    document.getElementById('p-stock-threshold').value = prod.stockThreshold || 5;
    document.getElementById('p-bosta-size').value = prod.bostaSize;
    const categorySelect = document.getElementById('p-category-select');
    Array.from(categorySelect?.options || []).forEach(option => { option.selected = (prod.category_ids || []).map(Number).includes(Number(option.dataset.id)) || (!(prod.category_ids || []).length && option.value === prod.category); });
    document.getElementById('p-tag-bestseller').checked = prod.bestseller;
    document.getElementById('p-desc').value = prod.desc;

    renderGalleryUploaderSlots(prod.images || []);

    document.getElementById('product-modal-title').textContent = 'تعديل المنتج';
    document.getElementById('product-modal').classList.remove('hidden');
};

window.deleteProduct = async function(id) {
    if (!confirm('هيتم إخفاء المنتج من صفحة الهبوط للحفاظ على الطلبات والسلال القديمة. موافق؟')) return;
    try {
        await Supabase.update('products', id, { is_active: false });
        sampleProducts = await sb_fetch('products') || [];
        renderProducts(sampleProducts);
    } catch(e) { alert('خطأ في الحذف: ' + e.message); }
};

window.toggleProductVisibility = async function(id, newActive) {
    try {
        await Supabase.update('products', id, { is_active: newActive });
        sampleProducts = await sb_fetch('products') || [];
        renderProducts(sampleProducts);
    } catch(e) { alert('خطأ تغيير حالة الإظهار: ' + e.message); }
};

window.editCategory = function(id) {
    const cat = sampleCategories.find(c => c.id === id);
    if (!cat) return;

    document.getElementById('cat-edit-id').value = cat.id;
    document.getElementById('cat-name').value = cat.name;
    document.getElementById('cat-desc').value = cat.desc;

    document.getElementById('cat-modal-title').textContent = 'تعديل القسم';
    document.getElementById('category-modal').classList.remove('hidden');
};

window.deleteCategory = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا القسم؟')) return;
    try {
        await sb_delete('categories', id);
        sampleCategories = await sb_fetch('categories') || [];
        renderCategories(sampleCategories);
        populateCategoryDropdowns();
    } catch(e) { alert('خطأ في الحذف: ' + e.message); }
};

// ==========================================
// 7. COMPLAINTS SYSTEM & WHATSAPP INTEGRATION
// ==========================================
let sampleComplaints = [];

let activeComplaintId = null;

async function initComplaintsSystem() {
    sampleComplaints = await sb_fetch('complaints') || [];
    renderComplaints(sampleComplaints);

    // Filters
    const filterAll = document.getElementById('filter-complaints-all');
    const filterNew = document.getElementById('filter-complaints-new');
    const filterResolved = document.getElementById('filter-complaints-resolved');

    if (filterAll) filterAll.addEventListener('click', () => {
        setComplaintFilterActive(filterAll);
        renderComplaints(sampleComplaints);
    });
    if (filterNew) filterNew.addEventListener('click', () => {
        setComplaintFilterActive(filterNew);
        renderComplaints(sampleComplaints.filter(c => c.status === 'new'));
    });
    if (filterResolved) filterResolved.addEventListener('click', () => {
        setComplaintFilterActive(filterResolved);
        renderComplaints(sampleComplaints.filter(c => c.status === 'resolved'));
    });

    // Mark as Resolved inside Modal
    const resolveBtn = document.getElementById('resolve-complaint-btn');
    if (resolveBtn) {
        resolveBtn.addEventListener('click', async () => {
            if (activeComplaintId !== null) {
                const c = sampleComplaints.find(item => item.id === activeComplaintId);
                if (c) {
                    await sb_update('complaints', activeComplaintId, {status: 'resolved'});
                    c.status = 'resolved';
                    renderComplaints(sampleComplaints);
                    document.getElementById('complaint-modal').classList.add('hidden');
                }
            }
        });
    }

    // Direct WhatsApp Chat
    const waBtn = document.getElementById('whatsapp-direct-btn');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            const phoneVal = document.getElementById('modal-c-phone').value;
            if (phoneVal) {
                const cleanPhone = phoneVal.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/2${cleanPhone}?text=${encodeURIComponent('أهلاً بك من خدمة عملاء أولاد القاضي، رداً على استفسارك...')}`, '_blank');
            }
        });
    }
}

function setComplaintFilterActive(activeBtn) {
    ['filter-complaints-all', 'filter-complaints-new', 'filter-complaints-resolved'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active-filter');
    });
    activeBtn.classList.add('active-filter');
}

function renderComplaints(complaints) {
    const container = document.getElementById('complaints-cards-container');
    if (!container) return;

    if (complaints.length === 0) {
        container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle w-full">لا توجد شكاوى في القائمة.</div>`;
        return;
    }

    container.innerHTML = complaints.map(c => `
        <div class="complaint-card glass-panel" onclick="openComplaintModal(${c.id})">
            <div class="flex-between">
                <strong class="text-primary font-bold text-lg">${c.client}</strong>
                <span class="badge ${c.status === 'new' ? 'badge-new' : 'badge-resolved'}">${c.status === 'new' ? 'جديد (معلق)' : 'تم الحل'}</span>
            </div>
            <span class="text-subtle text-sm">${c.date}</span>
            <p class="text-subtle text-sm mt-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${c.text}</p>
            <div class="flex-between mt-2 pt-2 border-b">
                <span class="text-primary font-bold text-sm">عرض التفاصيل <i class="fa-solid fa-arrow-left"></i></span>
                <span class="text-subtle text-sm" dir="ltr">${c.phone}</span>
            </div>
        </div>
    `).join('');
}

window.openComplaintModal = function(id) {
    const c = sampleComplaints.find(item => item.id === id);
    if (!c) return;
    activeComplaintId = id;

    document.getElementById('modal-c-client').textContent = `بلاغ العميل: ${c.client}`;
    document.getElementById('modal-c-date').textContent = c.date;
    document.getElementById('modal-c-text').textContent = c.text;
    document.getElementById('modal-c-phone').value = c.phone;

    const badgeEl = document.getElementById('modal-c-status-badge');
    if (badgeEl) {
        badgeEl.innerHTML = `<span class="badge ${c.status === 'new' ? 'badge-new' : 'badge-resolved'}">${c.status === 'new' ? 'جديد (معلق)' : 'تم الحل'}</span>`;
    }

    document.getElementById('complaint-modal').classList.remove('hidden');
};

// ==========================================
// 8. SITE SETTINGS & DYNAMIC COLOR PICKER
// ==========================================
let sampleSocials = [];
let sampleFaqs = [];
let siteSettingsId = 1;

async function initSiteSettings() {
    sampleSocials = await sb_fetch('socials') || [];
    sampleFaqs = await sb_fetch('faqs') || [];

    const settingsArr = await sb_fetch('site_settings');
    if (settingsArr && settingsArr.length > 0) {
        const settings = settingsArr[0];
        siteSettingsId = settings.id || 1;

        // Populating Identity
        if (settings.logo_header) {
            document.getElementById('setting-logo-header').value = settings.logo_header;
            document.getElementById('setting-logo-header-preview').src = settings.logo_header;
        }
        if (settings.logo_footer) {
            document.getElementById('setting-logo-footer').value = settings.logo_footer;
            document.getElementById('setting-logo-footer-preview').src = settings.logo_footer;
        }

        // Populating all CMS fields without overwriting them with UI defaults.
        const fields = {
            'setting-site-name': settings.site_name, 'setting-brand-name': settings.brand_name, 'setting-seo-desc': settings.seo_description,
            'setting-marquee-text': settings.marquee_text, 'setting-hero-title': settings.hero_title, 'setting-hero-subtitle': settings.hero_subtitle || settings.hero_description,
            'setting-hero-tagline': settings.hero_tagline, 'setting-catalog-title': settings.catalog_title, 'setting-catalog-subtitle': settings.catalog_subtitle,
            'setting-address': settings.address, 'setting-phone': settings.footer_phone || settings.phone, 'setting-whatsapp': settings.whatsapp_number, 'setting-bosta-package-type': settings.bosta_default_package_type || 'SMALL'
        };
        Object.entries(fields).forEach(([id, value]) => { const el = document.getElementById(id); if (el && value != null) el.value = value; });
        applyTrustCardFields(settings.trust_cards);
        applySectionVisibilityFields(settings.section_visibility);
        if (settings.marquee_behavior) document.getElementById('setting-marquee-behavior').value = settings.marquee_behavior;
        if (settings.marquee_end_date) document.getElementById('setting-marquee-end-date').value = settings.marquee_end_date.slice(0, 16);

        // Populating Toggles
        if (settings.shipping_custom) document.getElementById('custom-shipping-master-toggle').checked = true;
        if (settings.maintenance_mode) document.getElementById('maintenance-mode-toggle').checked = true;
    }

    renderSocialLinks();
    renderFaqs();

    // Attach logo file listeners
    const headerLogoFile = document.getElementById('setting-logo-header-file');
    if (headerLogoFile) {
        headerLogoFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await sb_upload(file);
                    document.getElementById('setting-logo-header').value = url;
                    document.getElementById('setting-logo-header-preview').src = url;
                } catch(err) {
                    alert('Upload failed');
                }
            }
        });
    }

    const footerLogoFile = document.getElementById('setting-logo-footer-file');
    if (footerLogoFile) {
        footerLogoFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                try {
                    const url = await sb_upload(file);
                    document.getElementById('setting-logo-footer').value = url;
                    document.getElementById('setting-logo-footer-preview').src = url;
                } catch(err) {
                    alert('Upload failed');
                }
            }
        });
    }

    const marqueeBehavior = document.getElementById('setting-marquee-behavior');
    const marqueeTimerGroup = document.getElementById('marquee-timer-group');
    if(marqueeBehavior && marqueeTimerGroup) {
        marqueeBehavior.addEventListener('change', (e) => {
            if(e.target.value === 'timer') {
                marqueeTimerGroup.classList.remove('hidden');
            } else {
                marqueeTimerGroup.classList.add('hidden');
            }
        });
        marqueeBehavior.dispatchEvent(new Event('change'));
    }

    // Custom Shipping Toggle Display
    const masterShippingToggle = document.getElementById('custom-shipping-master-toggle');
    const customShippingDetails = document.querySelector('.custom-shipping-details');
    if (masterShippingToggle && customShippingDetails) {
        masterShippingToggle.addEventListener('change', (e) => {
            if (e.target.checked) customShippingDetails.classList.remove('hidden');
            else customShippingDetails.classList.add('hidden');
        });
    }

    // Add Social Link
    const addSocialBtn = document.getElementById('add-social-link-btn');
    if (addSocialBtn) {
        addSocialBtn.addEventListener('click', async () => {
            const name = prompt('اسم قناة التواصل الجديدة:');
            const link = prompt('الرابط الكامل:');
            if (name && link) {
                const newSocial = { name, icon: 'fa-solid fa-link', link, visible: true };
                await sb_insert('socials', newSocial);
                sampleSocials = await sb_fetch('socials') || [];
                renderSocialLinks();
            }
        });
    }

    // Add FAQ Modal & Form
    const openAddFaqBtn = document.getElementById('open-add-faq-modal');
    const faqModal = document.getElementById('faq-modal');
    const faqForm = document.getElementById('faq-form');

    if (openAddFaqBtn && faqModal) {
        openAddFaqBtn.addEventListener('click', () => {
            if (faqForm) faqForm.reset();
            faqModal.classList.remove('hidden');
        });
    }

    if (faqForm) {
        faqForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const q = document.getElementById('faq-q').value;
            const a = document.getElementById('faq-a').value;
            const newFaq = { q, a, visible: true };
            await sb_insert('faqs', newFaq);
            sampleFaqs = await sb_fetch('faqs') || [];
            renderFaqs();
            faqModal.classList.add('hidden');
        });
    }

    // Save buttons logic
    const wrapSaveBtn = (id, saveFn) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', async (e) => {
                const originalText = btn.innerHTML;
                try {
                    btn.disabled = true;
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...`;
                    await saveFn();
                    alert('تم حفظ البيانات بنجاح!');
                } catch (err) {
                    alert('حدث خطأ أثناء الحفظ.');
                    console.error(err);
                } finally {
                    btn.disabled = false;
                    btn.innerHTML = originalText;
                }
            });
        }
    };

    wrapSaveBtn('save-identity-btn', async () => {
        await sb_update('site_settings', siteSettingsId, {
            logo_header: document.getElementById('setting-logo-header')?.value || null,
            logo_footer: document.getElementById('setting-logo-footer')?.value || null,
            site_name: document.getElementById('setting-site-name')?.value?.trim() || null,
            brand_name: document.getElementById('setting-brand-name')?.value?.trim() || null,
            seo_description: document.getElementById('setting-seo-desc')?.value?.trim() || null
        });
    });

    wrapSaveBtn('save-content-btn', async () => {
        await sb_update('site_settings', siteSettingsId, {
            marquee_text: document.getElementById('setting-marquee-text')?.value?.trim() || null,
            marquee_behavior: document.getElementById('setting-marquee-behavior')?.value || 'running',
            marquee_end_date: document.getElementById('setting-marquee-end-date')?.value || null,
            hero_title: document.getElementById('setting-hero-title')?.value?.trim() || null,
            hero_subtitle: document.getElementById('setting-hero-subtitle')?.value?.trim() || null,
            hero_tagline: document.getElementById('setting-hero-tagline')?.value?.trim() || null,
            catalog_title: document.getElementById('setting-catalog-title')?.value?.trim() || null,
            catalog_subtitle: document.getElementById('setting-catalog-subtitle')?.value?.trim() || null,
            trust_cards: readTrustCardFields(),
            section_visibility: readSectionVisibilityFields()
        });
    });

    wrapSaveBtn('save-contact-btn', async () => {
        const phone = document.getElementById('setting-phone')?.value?.trim() || null;
        const whatsapp = document.getElementById('setting-whatsapp')?.value?.trim() || null;
        if (phone && !/^01[0125]\d{8}$/.test(phone)) throw new Error('رقم الهاتف غير صحيح');
        if (whatsapp && !/^01[0125]\d{8}$/.test(whatsapp)) throw new Error('رقم الواتساب غير صحيح');
        await sb_update('site_settings', siteSettingsId, { address: document.getElementById('setting-address')?.value?.trim() || null, footer_phone: phone, whatsapp_number: whatsapp });
    });

    wrapSaveBtn('save-shipping-setting-btn', async () => {
        await sb_update('site_settings', siteSettingsId, {
            shipping_custom: document.getElementById('custom-shipping-master-toggle')?.checked || false,
            shipping_type: document.getElementById('custom-shipping-type')?.value || 'flat',
            shipping_flat_rate: Number(document.getElementById('custom-shipping-flat-rate')?.value) || 0
        });
    });

    wrapSaveBtn('save-bosta-setting-btn', async () => {
        const packageType = document.getElementById('setting-bosta-package-type')?.value || 'SMALL';
        if (!['SMALL', 'MEDIUM', 'LARGE', 'Light Bulky', 'Heavy Bulky'].includes(packageType)) throw new Error('حجم شحنة غير صحيح');
        await sb_update('site_settings', siteSettingsId, { bosta_default_package_type: packageType });
    });

    wrapSaveBtn('save-maintenance-btn', async () => {
        await sb_update('site_settings', siteSettingsId, {
            maintenance_mode: document.getElementById('maintenance-mode-toggle')?.checked || false,
            maintenance_message: document.getElementById('maintenance-message')?.value?.trim() || null
        });
    });
}

function readTrustCardFields() {
    return [1, 2, 3].map(index => ({ icon: document.getElementById(`trust-${index}-icon`)?.value?.trim() || '', title: document.getElementById(`trust-${index}-title`)?.value?.trim() || '', text: document.getElementById(`trust-${index}-text`)?.value?.trim() || '' })).filter(card => card.title || card.text);
}
function applyTrustCardFields(cards) {
    const list = Array.isArray(cards) ? cards : [];
    [1, 2, 3].forEach((index, offset) => {
        const card = list[offset] || {};
        const icon = document.getElementById(`trust-${index}-icon`); const title = document.getElementById(`trust-${index}-title`); const text = document.getElementById(`trust-${index}-text`);
        if (icon) icon.value = card.icon || ''; if (title) title.value = card.title || ''; if (text) text.value = card.text || '';
    });
}
function readSectionVisibilityFields() {
    return { trust: document.getElementById('show-trust')?.checked !== false, products: document.getElementById('show-products')?.checked !== false, faq: document.getElementById('show-faq')?.checked !== false, testimonials: document.getElementById('show-testimonials')?.checked !== false };
}
function applySectionVisibilityFields(value) {
    const visibility = value && typeof value === 'object' ? value : {};
    [['show-trust', 'trust'], ['show-products', 'products'], ['show-faq', 'faq'], ['show-testimonials', 'testimonials']].forEach(([id, key]) => { const el = document.getElementById(id); if (el && visibility[key] !== undefined) el.checked = visibility[key] !== false; });
}

function renderSocialLinks() {
    const list = document.getElementById('social-links-list');
    if (!list) return;

    list.innerHTML = sampleSocials.map(s => `
        <div class="card-item flex-between">
            <div class="flex-align gap-3"><i class="${safeText(s.icon || 'fa-solid fa-link')} text-primary text-lg"></i><div><strong class="text-dark block">${safeText(s.name)}</strong><span class="text-subtle text-sm">${safeText(s.link)}</span></div></div>
            <div class="flex-align gap-3"><label class="switch-toggle" title="إظهار/إخفاء"><input type="checkbox" ${s.visible ? 'checked' : ''} onchange="toggleSocialVisible(${Number(s.id)})"><span class="slider"></span></label><button class="btn btn-ghost btn-sm" onclick="editSocial(${Number(s.id)})"><i class="fa-solid fa-pen"></i></button><button class="btn btn-danger-ghost btn-sm" onclick="deleteSocial(${Number(s.id)})"><i class="fa-solid fa-trash"></i></button></div>
        </div>`).join('');
}

function renderFaqs() {
    const list = document.getElementById('faq-list-container');
    if (!list) return;

    list.innerHTML = sampleFaqs.map(f => `
        <div class="card-item flex-between"><div class="flex-1"><strong class="text-primary block font-bold mb-1"><i class="fa-solid fa-question-circle"></i> ${safeText(f.q)}</strong><p class="text-subtle text-sm">${safeText(f.a)}</p></div>
            <div class="flex-align gap-3"><label class="switch-toggle" title="تفعيل/إخفاء السؤال"><input type="checkbox" ${f.visible ? 'checked' : ''} onchange="toggleFaqVisible(${Number(f.id)})"><span class="slider"></span></label><button class="btn btn-ghost btn-sm" onclick="editFaq(${Number(f.id)})"><i class="fa-solid fa-pen"></i></button><button class="btn btn-danger-ghost btn-sm" onclick="deleteFaq(${Number(f.id)})"><i class="fa-solid fa-trash"></i></button></div>
        </div>`).join('');
}

window.toggleSocialVisible = async function(id) {
    const item = sampleSocials.find(s => s.id === id);
    if (!item) return;
    const next = !item.visible;
    try { await sb_update('socials', id, { visible: next }); item.visible = next; }
    catch(e) { alert('خطأ في التحديث: ' + e.message); }
};
window.editSocial = async function(id) {
    const item = sampleSocials.find(s => s.id === id); if (!item) return;
    const name = prompt('اسم القناة:', item.name); if (!name) return;
    const link = prompt('الرابط الكامل:', item.link); if (!link || !ADMIN_ALLOWED_SOCIAL_SCHEMES.test(link) || link.includes('#')) return alert('الرابط غير مسموح');
    try { await sb_update('socials', id, { name: name.trim(), link: link.trim() }); sampleSocials = await sb_fetch('socials') || []; renderSocialLinks(); }
    catch(e) { alert('خطأ في تعديل القناة: ' + e.message); }
};
window.deleteSocial = async function(id) {
    if(confirm('هل أنت متأكد؟')) {
        try {
            await sb_delete('socials', id);
            sampleSocials = await sb_fetch('socials') || [];
            renderSocialLinks();
        } catch(e) { alert('خطأ في الحذف'); }
    }
};

window.editFaq = async function(id) {
    const item = sampleFaqs.find(f => f.id === id); if (!item) return;
    const q = prompt('السؤال:', item.q); if (!q) return;
    const a = prompt('الإجابة:', item.a); if (!a) return;
    try { await sb_update('faqs', id, { q: q.trim(), a: a.trim() }); sampleFaqs = await sb_fetch('faqs') || []; renderFaqs(); }
    catch(e) { alert('خطأ في تعديل السؤال: ' + e.message); }
};

window.toggleFaqVisible = async function(id) {
    const item = sampleFaqs.find(f => f.id === id);
    if (item) {
        item.visible = !item.visible;
        try {
            await sb_update('faqs', id, { visible: item.visible });
        } catch(e) { alert('خطأ في التحديث'); }
    }
};
window.deleteFaq = async function(id) {
    if(confirm('هل أنت متأكد؟')) {
        try {
            await sb_delete('faqs', id);
            sampleFaqs = await sb_fetch('faqs') || [];
            renderFaqs();
        } catch(e) { alert('خطأ في الحذف'); }
    }
};

// Generic Modal Overlay Closes
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
        const overlay = e.target.closest('.modal-overlay');
        if (overlay) overlay.classList.add('hidden');
    });
});

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.add('hidden');
    });
});
