/* admin.js - Awlad El-Kady Admin Dashboard Full Functional UI Engine */
window.ADMIN_API = true;

function sanitizeFormValue(value, maxLength = 5000) {
    return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, maxLength);
}

function escapeAdminHtml(value, maxLength = 5000) {
    return sanitizeFormValue(value, maxLength).replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

function sanitizeFormData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
    return Object.fromEntries(Object.entries(data).map(([key, value]) => [
        key,
        typeof value === 'string' ? sanitizeFormValue(value) : value
    ]));
}

window.sb_fetch = async (table) => {
    try {
        const data = await Supabase.select(table, table === 'site_settings' ? 'id=eq.1' : 'order=created_at.desc');
        // Schema Adapter map
        if (table === 'products') return data.map(p => ({id: p.id, name: p.name, sku: p.sku, price: p.price, salePrice: p.sale_price, stock: p.stock, stockThreshold: p.stock_threshold, bostaSize: p.bosta_size, category: p.category || '', is_active: p.is_active !== false, bestseller: p.is_bestseller, desc: p.description, images: p.images || [], sizes: Array.isArray(p.sizes) ? p.sizes : []}));
        if (table === 'orders') return data.map(o => ({id: String(o.id), status: o.status, date: new Date(o.created_at).toLocaleDateString('ar-EG'), name: o.customer_name, phone: o.customer_phone, secondPhone: o.customer_second_phone, gov: o.governorate, area: o.area, address: o.address, subtotal: o.subtotal || 0, shipping: o.shipping_fee || 0, notes: o.notes, items: o.items || [], tracking_number: o.tracking_number || '—'}));
        if (table === 'complaints') return data.map(c => ({id: c.id, client: c.customer_name, phone: c.customer_phone, date: new Date(c.created_at).toLocaleDateString('ar-EG'), status: c.status, text: c.message, notes: c.notes || '', is_archived: c.is_archived === true}));
        if (table === 'site_settings' && data.length) return [{id: data[0].id, q: '', a: '', ...data[0]}];
        if (table === 'faqs' || table === 'socials') return data.map(d => ({...d, visible: d.is_visible !== false}));
        return data;
    } catch(e) { console.error(e); return []; }
};

window.sb_insert = async (table, data) => {
    data = sanitizeFormData(data);
    if (table === 'products') data = {name: data.name, sku: data.sku || '', price: parseFloat(data.price)||0, sale_price: data.salePrice ? parseFloat(data.salePrice) : null, stock: parseInt(data.stock)||0, stock_threshold: parseInt(data.stockThreshold)||5, bosta_size: parseFloat(data.bostaSize)||0, category: data.category, is_bestseller: !!data.bestseller, description: data.desc || '', sizes: Array.isArray(data.sizes) ? data.sizes : [], images: data.images || [], is_active: true};
    if (table === 'categories') data = {name: data.name, description: data.desc};
    if (table === 'faqs') data = {q: data.q, a: data.a, is_visible: data.visible !== false, sort_order: 1};
    if (table === 'socials') data = {name: data.name, icon: data.icon, link: data.link, is_visible: data.visible !== false, sort_order: 1};
    await Supabase.insert(table, data);
};

window.sb_update = async (table, id, data) => {
    data = sanitizeFormData(data);
    if (table === 'products') data = {name: data.name, sku: data.sku || '', price: parseFloat(data.price)||0, sale_price: data.salePrice ? parseFloat(data.salePrice) : null, stock: parseInt(data.stock)||0, stock_threshold: parseInt(data.stockThreshold)||5, bosta_size: parseFloat(data.bostaSize)||0, category: data.category, is_bestseller: !!data.bestseller, description: data.desc || '', sizes: Array.isArray(data.sizes) ? data.sizes : [], images: data.images || []};
    if (table === 'products_visibility') { await Supabase.update('products', id, {is_active: data.is_active}); return; }
    if (table === 'categories') data = {name: data.name, description: data.desc || ''};
    if (table === 'complaints') data = { ...(data.status !== undefined ? { status: data.status } : {}), ...(data.message !== undefined ? { message: data.message } : {}), ...(data.notes !== undefined ? { notes: data.notes } : {}), ...(data.is_archived !== undefined ? { is_archived: data.is_archived } : {}), ...(data.archived_at !== undefined ? { archived_at: data.archived_at } : {}), ...(data.archive_reason !== undefined ? { archive_reason: data.archive_reason } : {}) };
    if (table === 'faqs') data = { ...(data.q !== undefined ? { q: data.q } : {}), ...(data.a !== undefined ? { a: data.a } : {}), ...(data.visible !== undefined ? { is_visible: data.visible } : {}) };
    if (table === 'socials') data = {is_visible: data.visible};
    if (table === 'site_settings') { /* pass through */ }
    await Supabase.update(table, id, data);
};

window.sb_delete = async (table, id) => await Supabase.delete(table, id);
window.sb_upload = async (file) => await Supabase.upload(file);document.addEventListener('DOMContentLoaded', () => {
    initPasswordAuth();
    initDateBadge();
    initNavigation();
    initAswanShippingCalc();
    initOrdersSystem();
    initProductsAndCategories();
    initComplaintsSystem();
    initSiteSettings();
    document.querySelector('.settings-tab-btn[data-tab="tab-contact"]')?.addEventListener('click', () => {
        if (adminStoreMap) setTimeout(() => adminStoreMap.invalidateSize(), 100);
    });

    // Polling Mechanism (Sync every 15s)
    setInterval(async () => {
        // Prevent re-rendering if user is editing inside a modal
        if (document.querySelectorAll('.modal-overlay:not(.hidden)').length === 0) {
            sampleOrders = await sb_fetch('orders') || [];
            if(document.getElementById('view-orders')?.classList.contains('active')) renderOrders(sampleOrders);

            sampleComplaints = await sb_fetch('complaints') || [];
            if(document.getElementById('view-complaints')?.classList.contains('active')) renderComplaints(sampleComplaints);

            sampleProducts = await sb_fetch('products') || [];
            if(document.getElementById('view-products')?.classList.contains('active')) renderProducts(sampleProducts);
        }
    }, 15000);
});

// ==========================================
// 1. PIN PASSWORD AUTHENTICATION
// ==========================================
function initPasswordAuth() {
    const loginForm = document.getElementById('login-form');
    const loginScreen = document.getElementById('login-screen');
    const pwdInput = document.getElementById('password-only');
    const loginError = document.getElementById('login-error');
    const dashboard = document.getElementById('dashboard');

    if (loginForm && loginScreen) {
        fetch('/api/admin?action=check', { credentials: 'include' }).then(response => {
            if (response.ok) {
                loginScreen.classList.add('unlocked');
                dashboard.classList.remove('hidden');
                return response.json();
            }
            throw new Error('not authenticated');
        }).then(details => {
            window.ADMIN_ACCESS = { admin: details.admin === true, owner: details.admin === true, permissions: details.permissions || (details.admin ? { '*': true } : {}) };
            applyPermissionVisibility();
            if (details.admin === true) initStaffAccounts();
        }).catch(() => {});
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const password = pwdInput ? pwdInput.value : '';
            const employeePhone = document.getElementById('employee-phone')?.value?.trim() || '';
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            if (!password) return;
            if (submitBtn) submitBtn.disabled = true;
            try {
                const response = await fetch('/api/admin?action=auth', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    credentials: 'include', body: JSON.stringify({ password, employeePhone })
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
                localStorage.setItem('admin_authenticated', 'true');
                window.ADMIN_ACCESS = { admin: details.admin === true, owner: details.admin === true, permissions: details.permissions || (details.admin ? { '*': true } : {}) };
                applyPermissionVisibility();
                if (!details.admin) fetch('/api/admin?action=presence', { method: 'POST', credentials: 'include' });
                if (details.admin === true) {
                    document.getElementById('open-bulk-import')?.classList.remove('hidden');
                    document.querySelector('.settings-tab-btn[data-tab="tab-staff"]')?.classList.remove('hidden');
                    initStaffAccounts();
                } else {
                    document.getElementById('open-bulk-import')?.classList.add('hidden');
                    document.querySelector('.settings-tab-btn[data-tab="tab-staff"]')?.classList.add('hidden');
                }
            } catch (error) {
                loginError.textContent = error.status === 503
                    ? 'تسجيل الدخول غير مهيأ على الخادم. تحقق من متغيرات Vercel السرية.'
                    : error.status === 403
                        ? 'الحساب غير مصرح له كمدير.'
                        : 'كلمة المرور غير صحيحة.';
                if (pwdInput) { pwdInput.value = ''; pwdInput.focus(); }
                const employeePhoneInput = document.getElementById('employee-phone');
                if (employeePhoneInput) employeePhoneInput.value = '';
                console.error('[admin-auth]', error.status || 'network', error.message);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }
    setInterval(() => { if (window.ADMIN_ACCESS && !window.ADMIN_ACCESS.owner) fetch('/api/admin?action=presence', { method: 'POST', credentials: 'include' }); }, 60000);

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            await fetch('/api/admin?action=logout', { method: 'POST', credentials: 'include' });
            loginScreen.classList.remove('unlocked');
            dashboard.classList.add('hidden');
            document.getElementById('open-bulk-import')?.classList.add('hidden');
            document.getElementById('bulk-import-panel')?.classList.add('hidden');
            document.querySelector('.settings-tab-btn[data-tab="tab-staff"]')?.classList.add('hidden');
            if (pwdInput) pwdInput.value = '';
            localStorage.removeItem('admin_authenticated');
            const employeePhoneInput = document.getElementById('employee-phone');
            if (employeePhoneInput) employeePhoneInput.value = '';
            if (loginError) loginError.textContent = '';
        });
    }
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

// ==========================================
// 3. MAIN NAVIGATION & SUBTABS
// ==========================================
function initNavigation() {
    const navItems = document.querySelectorAll('.sidebar .nav-item');
    applyPermissionVisibility();
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
        mobileMenuBtn.addEventListener('click', () => {
            const isMobile = window.matchMedia('(max-width: 768px)').matches;
            if (isMobile) sidebar.classList.toggle('open');
            else document.body.classList.toggle('sidebar-collapsed');
            mobileMenuBtn.setAttribute('aria-expanded', String(isMobile ? sidebar.classList.contains('open') : !document.body.classList.contains('sidebar-collapsed')));
        });
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
    const settingsContainer = document.querySelector('.settings-container');
    const settingsMainTabs = document.querySelectorAll('.settings-main-tab');
    const landingSettingsSidebar = document.querySelector('.settings-sidebar');
    const settingsContent = document.querySelector('.settings-content');
    const setSettingsMode = mode => {
        const adminMode = mode === 'admin';
        settingsContainer?.classList.toggle('admin-settings-mode', adminMode);
        landingSettingsSidebar?.classList.toggle('hidden', adminMode);
        settingsContent?.querySelectorAll('.tab-content-item').forEach(item => {
            item.classList.toggle('active', adminMode ? item.id === 'tab-staff' : item.id === 'tab-identity');
            item.classList.toggle('hidden', adminMode ? item.id !== 'tab-staff' : item.id === 'tab-staff');
        });
        if (adminMode) {
            document.querySelector('.settings-tab-btn[data-tab="tab-staff"]')?.classList.add('active');
            initStaffAccounts();
        } else {
            document.querySelectorAll('.settings-tab-btn').forEach(item => item.classList.remove('active'));
            document.querySelector('.settings-tab-btn[data-tab="tab-identity"]')?.classList.add('active');
        }
    };
    settingsMainTabs.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsMainTabs.forEach(item => {
                item.classList.remove('active');
                item.setAttribute('aria-selected', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-selected', 'true');
            setSettingsMode(btn.dataset.settingsView || 'landing');
        });
    });
    setSettingsMode('landing');

    settingsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const target = btn.getAttribute('data-tab');
                if (target) {
                    tabContentItems.forEach(t => t.classList.remove('active'));
                    const activeTab = document.getElementById(target);
                    if (activeTab) activeTab.classList.add('active');
                    if (target === 'tab-contact' && adminStoreMap) setTimeout(() => adminStoreMap.invalidateSize(), 100);
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
let sampleProducts = [];
let sampleCategories = [];

async function initOrdersSystem() {
    sampleOrders = await sb_fetch('orders') || [];
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
            exportBtn.disabled = true;
            exportBtn.setAttribute('aria-busy', 'true');
            const originalLabel = exportBtn.textContent;
            exportBtn.textContent = 'جاري تجهيز الملف...';
            try {
                XLSX.writeFile(wb, `bosta_orders_export_${new Date().toISOString().split('T')[0]}.xlsx`);
            } finally {
                exportBtn.disabled = false;
                exportBtn.removeAttribute('aria-busy');
                exportBtn.textContent = originalLabel;
            }
        });
    }
}

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
            ? `<span class="text-subtle text-sm block mt-1"><i class="fa-solid fa-truck"></i> بوليصة: <strong dir="ltr">${o.tracking_number}</strong></span>`
            : `<span class="text-subtle text-sm block mt-1 opacity-50">لا يوجد رقم بوليصة حتى الآن</span>`;

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
                    <div class="flex-align gap-2">
                        <button class="btn btn-ghost btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i> طباعة</button>
                    </div>
                    <span class="text-subtle text-sm">فرعي: ${(o.subtotal||0).toFixed(2)} | إجمالي: <strong class="text-primary">${total} ج.م</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

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
    sampleProducts = await sb_fetch('products') || [];
    sampleCategories = await sb_fetch('categories') || [];
    renderProducts(sampleProducts);
    renderCategories(sampleCategories);
    populateCategoryDropdowns();
    renderGalleryUploaderSlots([]);
    initBulkProductImport();

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
                const stockVal = parseInt(document.getElementById('p-stock')?.value) || 0;
                const thresholdVal = parseInt(document.getElementById('p-stock-threshold')?.value) || 5;

                const newProd = {
                    name: document.getElementById('p-name')?.value,
                    sku: document.getElementById('p-sku')?.value,
                    price: parseFloat(document.getElementById('p-price')?.value),
                    salePrice: document.getElementById('p-sale-price')?.value,
                    stock: stockVal,
                    stockThreshold: thresholdVal,
                    bostaSize: parseFloat(document.getElementById('p-bosta-size')?.value),
                    category: document.getElementById('p-category-select')?.value,
                    bestseller: document.getElementById('p-tag-bestseller')?.checked,
                    desc: document.getElementById('p-desc')?.value,
                    images: currentEditingImages
                };

                if (editId) {
                    await sb_update('products', editId, newProd);
                } else {
                    await sb_insert('products', newProd);
                }

                sampleProducts = await sb_fetch('products') || [];
                renderProducts(sampleProducts);
                productModal.classList.add('hidden');
                alert('تم حفظ المنتج بنجاح!');
            } catch(error) {
                alert('حدث خطأ أثناء الحفظ. يرجى المحاولة لاحقاً.');
                console.error(error);
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
            const editId = document.getElementById('cat-edit-id').value;
            const name = document.getElementById('cat-name').value;
            const desc = document.getElementById('cat-desc').value;

            if (editId) {
                await sb_update('categories', editId, {name, desc});
            } else {
                await sb_insert('categories', {name, desc});
            }

            sampleCategories = await sb_fetch('categories') || [];
            renderCategories(sampleCategories);
            populateCategoryDropdowns();
            categoryModal.classList.add('hidden');
        });
    }
}

function populateCategoryDropdowns() {
    const select = document.getElementById('p-category-select');
    if (!select) return;
    select.innerHTML = sampleCategories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
}

function renderProducts(products) {
    const container = document.getElementById('products-cards-container');
    if (!container) return;

    if (!products || products.length === 0) {
        container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle w-full" style="grid-column: 1 / -1;">لا توجد منتجات مضافة حتى الآن. اضغط على زر "إضافة منتج جديد" للبدء.</div>`;
        return;
    }

    container.innerHTML = products.map(p => {
        const isLowStock = p.stock <= (p.stockThreshold || 5);
        const mainImg  = p.images?.find(i => i?.main)?.url || p.images?.[0]?.url || '';
        const thumbHtml = mainImg
            ? `<img src="${mainImg}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
            : `<i class="fa-solid fa-box-open" style="font-size:2rem;color:var(--text-subtle)"></i>`;

        return `
            <div class="product-card${p.is_active === false ? ' opacity-50' : ''}">
                <div class="product-thumb-container" style="position:relative;background:#f1f5f2;border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:120px;">
                    ${thumbHtml}
                    <div class="badge-overlay-container" style="position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:4px;">
                        ${!p.is_active ? '<span class="badge" style="background:#ef4444;color:#fff;">مخفي</span>' : ''}
                        ${p.bestseller ? '<span class="badge badge-resolved">الأكثر مبيعاً</span>' : ''}
                        ${isLowStock ? '<span class="badge badge-new"><i class="fa-solid fa-triangle-exclamation"></i> (' + p.stock + ')</span>' : ''}
                    </div>
                </div>
                <div class="product-card-body">
                    <span class="text-subtle text-sm block mb-1">${p.category}</span>
                    <strong class="text-primary font-bold text-lg mb-1">${p.name}</strong>
                    <span class="text-subtle text-sm mb-2">SKU: ${p.sku || '—'} | بوسطة: ${p.bostaSize || 0} ج</span>
                    ${p.sizes?.length ? `<span class="text-subtle text-sm mb-2">المقاسات: ${p.sizes.join('، ')}</span>` : ''}
                    <p class="text-subtle text-sm mb-3" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.desc || ''}</p>
                    <div class="flex-between mt-auto">
                        <div>
                            <strong class="text-primary text-lg">${p.salePrice ? p.salePrice : p.price} ج.م</strong>
                            ${p.salePrice ? `<span class="text-subtle text-sm" style="text-decoration:line-through;">${p.price} ج</span>` : ''}
                        </div>
                        <span class="text-sm font-bold ${isLowStock ? 'text-danger' : 'text-emerald'}">${p.stock} قطعة</span>
                    </div>
                    <div class="product-card-actions">
                        <button class="btn btn-ghost btn-sm" onclick="editProduct(${p.id})"><i class="fa-solid fa-pen"></i> تعديل</button>
                        <button class="btn btn-ghost btn-sm" title="${p.is_active ? 'إخفاء' : 'إظهار'}" onclick="toggleProductVisibility(${p.id}, ${!p.is_active})">
                            <i class="fa-solid ${p.is_active ? 'fa-eye-slash' : 'fa-eye'}"></i>
                        </button>
                        <button class="btn btn-danger-ghost btn-sm" onclick="deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function renderCategories(categories) {
    const container = document.getElementById('categories-cards-container');
    if (!container) return;

    if (!categories || categories.length === 0) {
        container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle w-full" style="grid-column: 1 / -1;">لا توجد أقسام مضافة حتى الآن. اضغط على زر "إضافة قسم جديد" للبدء.</div>`;
        return;
    }

    container.innerHTML = categories.map(c => `
        <div class="category-card glass-panel">
            <div>
                <strong class="text-primary block font-bold text-lg">${c.name}</strong>
                <span class="text-subtle text-sm">${c.desc}</span>
            </div>
            <div class="flex-align gap-2">
                <button class="btn btn-ghost btn-sm" onclick="editCategory(${c.id})"><i class="fa-solid fa-pen"></i></button>
                <button class="btn btn-danger-ghost btn-sm" onclick="deleteCategory(${c.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
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
        alert("Upload failed.");
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
    document.getElementById('p-category-select').value = prod.category;
    document.getElementById('p-tag-bestseller').checked = prod.bestseller;
    document.getElementById('p-desc').value = prod.desc;

    renderGalleryUploaderSlots(prod.images || []);

    document.getElementById('product-modal-title').textContent = 'تعديل المنتج';
    document.getElementById('product-modal').classList.remove('hidden');
};

window.deleteProduct = async function(id) {
    if (!confirm('هل أنت متأكد من حذف هذا المنتج نهائياً؟')) return;
    try {
        await sb_delete('products', id);
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
    sampleComplaints = sampleComplaints.filter(item => !item.is_archived);
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
    document.getElementById('save-complaint-btn')?.addEventListener('click', async () => {
        if (activeComplaintId === null) return;
        await sb_update('complaints', activeComplaintId, { message: document.getElementById('modal-c-text').value.trim(), notes: document.getElementById('modal-c-notes').value.trim() });
        sampleComplaints = await sb_fetch('complaints') || []; renderComplaints(sampleComplaints); document.getElementById('complaint-modal').classList.add('hidden');
    });
    document.getElementById('delete-complaint-btn')?.addEventListener('click', async () => {
        if (activeComplaintId === null || !confirm('هل أنت متأكد من حذف الشكوى؟')) return;
        await sb_update('complaints', activeComplaintId, { is_archived: true, archived_at: new Date().toISOString(), archive_reason: 'حذف من لوحة الإدارة' });
        sampleComplaints = sampleComplaints.filter(item => item.id !== activeComplaintId); renderComplaints(sampleComplaints); document.getElementById('complaint-modal').classList.add('hidden');
    });

    const waBtn = document.getElementById('whatsapp-direct-btn');
    if (waBtn) {
        waBtn.addEventListener('click', () => {
            const phoneVal = document.getElementById('modal-c-phone').value;
            if (phoneVal) {
                const cleanPhone = phoneVal.replace(/[^0-9]/g, '');
                window.open(`https://wa.me/2${cleanPhone}?text=${encodeURIComponent('أهلاً بك من خدمة عملاء أولاد القاضي، رداً على استفسارك...')}`, '_blank', 'noopener,noreferrer');
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
                <strong class="text-primary font-bold text-lg">${escapeAdminHtml(c.client, 120)}</strong>
                <span class="badge ${c.status === 'new' ? 'badge-new' : 'badge-resolved'}">${c.status === 'new' ? 'جديد (معلق)' : 'تم الحل'}</span>
            </div>
            <span class="text-subtle text-sm">${escapeAdminHtml(c.date, 40)}</span>
            <p class="text-subtle text-sm mt-1" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${escapeAdminHtml(c.text, 1000)}</p>
            <div class="flex-between mt-2 pt-2 border-b">
                <span class="text-primary font-bold text-sm">عرض التفاصيل <i class="fa-solid fa-arrow-left"></i></span>
                <span class="text-subtle text-sm" dir="ltr">${escapeAdminHtml(c.phone, 30)}</span>
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
    document.getElementById('modal-c-text').value = c.text || '';
    document.getElementById('modal-c-notes').value = c.notes || '';
    document.getElementById('modal-c-phone').value = c.phone;

    const badgeEl = document.getElementById('modal-c-status-badge');
    if (badgeEl) {
        badgeEl.innerHTML = `<span class="badge ${c.status === 'new' ? 'badge-new' : 'badge-resolved'}">${c.status === 'new' ? 'جديد (معلق)' : 'تم الحل'}</span>`;
    }

    document.getElementById('complaint-modal').classList.remove('hidden');
};

function applyPermissionVisibility() {
    if (!window.ADMIN_ACCESS) return;
    const isOwner = window.ADMIN_ACCESS.owner === true || window.ADMIN_ACCESS.admin === true;
    const permissions = window.ADMIN_ACCESS?.permissions || {};
    const allowed = key => isOwner || permissions['*'] === true || permissions[key] === true || permissions[key.replace('view_', '') + '.view'] === true;
    document.querySelectorAll('[data-permission]').forEach(element => {
        element.classList.toggle('hidden', !allowed(element.dataset.permission));
    });
    const firstVisible = [...document.querySelectorAll('.sidebar .nav-item')].find(item => !item.classList.contains('hidden'));
    if (firstVisible && !document.querySelector('.sidebar .nav-item.active:not(.hidden)')) firstVisible.click();
}


// ==========================================
// 8. SITE SETTINGS & DYNAMIC COLOR PICKER
// ==========================================
let sampleSocials = [];
let sampleFaqs = [];
let adminStoreMap = null;
let adminStoreMarker = null;

function initAdminStoreMap() {
    const container = document.getElementById('admin-store-map');
    if (!container || typeof L === 'undefined') return;
    const latInput = document.getElementById('setting-map-lat');
    const lngInput = document.getElementById('setting-map-lng');
    const fallback = [24.4767, 32.9463];
    const lat = Number(latInput?.value) || fallback[0];
    const lng = Number(lngInput?.value) || fallback[1];
    adminStoreMap = L.map(container).setView([lat, lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors' }).addTo(adminStoreMap);
    adminStoreMarker = L.marker([lat, lng], { draggable: true }).addTo(adminStoreMap);
    const syncInputs = point => { latInput.value = point.lat.toFixed(7); lngInput.value = point.lng.toFixed(7); markSettingsDirty(); };
    adminStoreMarker.on('dragend', event => syncInputs(event.target.getLatLng()));
    adminStoreMap.on('click', event => { adminStoreMarker.setLatLng(event.latlng); syncInputs(event.latlng); });
    [latInput, lngInput].forEach(input => input?.addEventListener('change', () => {
        const point = L.latLng(Number(latInput.value) || fallback[0], Number(lngInput.value) || fallback[1]);
        adminStoreMarker.setLatLng(point); adminStoreMap.setView(point);
    }));
    setTimeout(() => adminStoreMap.invalidateSize(), 100);
}


async function initSiteSettings() {
    const loading = document.getElementById('settings-loading');
    if (loading) loading.removeAttribute('hidden');
    try {
    const settingsPromise = sb_fetch('site_settings');
    const [settingsArr, socialsArr, faqsArr] = await Promise.all([settingsPromise, sb_fetch('socials'), sb_fetch('faqs')]);
    sampleSocials = socialsArr || [];
    sampleFaqs = faqsArr || [];
    if (settingsArr && settingsArr.length > 0) {
        const settings = settingsArr[0];
        const setValue = (id, value) => { const field = document.getElementById(id); if (field && value != null) field.value = value; };
        setValue('setting-site-name', settings.site_name); setValue('setting-brand-name', settings.brand_name); setValue('setting-seo-desc', settings.seo_description); setValue('setting-marquee-text', settings.marquee_text); setValue('setting-hero-title', settings.hero_title);

        // Populating Identity
        if (settings.logo_header) {
            document.getElementById('setting-logo-header').value = settings.logo_header;
            document.getElementById('setting-logo-header-preview').src = settings.logo_header;
        }
        if (settings.logo_footer) {
            document.getElementById('setting-logo-footer').value = settings.logo_footer;
            document.getElementById('setting-logo-footer-preview').src = settings.logo_footer;
        }

        // Populating Content
        if (settings.marquee_behavior) document.getElementById('setting-marquee-behavior').value = settings.marquee_behavior;
        if (settings.marquee_end_date) document.getElementById('setting-marquee-end-date').value = settings.marquee_end_date;

        // Populating Toggles
        if (settings.shipping_custom != null) document.getElementById('custom-shipping-master-toggle').checked = settings.shipping_custom === true;
        if (settings.maintenance_mode != null) document.getElementById('maintenance-mode-toggle').checked = settings.maintenance_mode === true;
        if (document.getElementById('setting-footer-phone-visible')) document.getElementById('setting-footer-phone-visible').checked = settings.footer_phone_visible !== false;
        if (document.getElementById('setting-whatsapp-visible')) document.getElementById('setting-whatsapp-visible').checked = settings.whatsapp_visible !== false;
        setValue('setting-map-lat', settings.map_latitude); setValue('setting-map-lng', settings.map_longitude);
        if (settings.maintenance_message != null) setValue('maintenance-message', settings.maintenance_message);
        if (settings.shipping_type != null) setValue('custom-shipping-type', settings.shipping_type);
        if (settings.shipping_flat_rate != null) setValue('custom-shipping-flat-rate', settings.shipping_flat_rate);
        ['address', 'footer_phone', 'whatsapp_number', 'bosta_webhook', 'bosta_payment_type', 'bosta_default_size'].forEach(key => {
            const field = document.getElementById({ address: 'setting-address', footer_phone: 'setting-footer-phone', whatsapp_number: 'setting-whatsapp', bosta_webhook: 'setting-bosta-webhook', bosta_payment_type: 'setting-bosta-payment', bosta_default_size: 'setting-bosta-size' }[key]);
            if (field && settings[key] != null) field.value = settings[key];
        });
    }

    initAdminStoreMap();
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
            const q = document.getElementById('faq-q').value.trim();
            const a = document.getElementById('faq-a').value.trim();
            const editId = faqForm.dataset.editId;
            if (editId) await sb_update('faqs', editId, { q, a }); else await sb_insert('faqs', { q, a, visible: true });
            sampleFaqs = await sb_fetch('faqs') || []; renderFaqs(); delete faqForm.dataset.editId; faqModal.classList.add('hidden');
        });
    }

    document.getElementById('submit-password-request-btn')?.addEventListener('click', async () => {
        const reason = document.getElementById('password-request-reason')?.value?.trim();
        if (!reason) return alert('اكتب سبب الطلب أولاً');
        const response = await fetch('/api/admin?action=profile-requests', {method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body:JSON.stringify({reason})});
        document.getElementById('profile-request-result').textContent = response.ok ? 'تم إرسال الطلب للإدارة.' : 'تعذر إرسال الطلب.';
    });
    const requestsList = document.getElementById('profile-requests-list');
    if (requestsList && window.ADMIN_ACCESS?.admin) {
        fetch('/api/admin?action=profile-requests', {credentials:'include'}).then(response => response.ok ? response.json() : []).then(rows => {
            requestsList.innerHTML = rows.map(row => `<div class="card-item"><strong>${escapeAdminHtml(row.reason)}</strong><span class="text-subtle">${row.status}</span><button class="btn btn-emerald btn-sm" data-request-id="${row.id}">موافقة</button><button class="btn btn-danger-ghost btn-sm" data-reject-id="${row.id}">رفض</button></div>`).join('');
            requestsList.querySelectorAll('[data-request-id]').forEach(button => button.onclick = () => reviewProfileRequest(button.dataset.requestId, 'approved'));
            requestsList.querySelectorAll('[data-reject-id]').forEach(button => button.onclick = () => reviewProfileRequest(button.dataset.rejectId, 'rejected'));
        });
    }
    const wrapSaveBtn = (id, saveFn) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', async (e) => {
                const originalText = btn.innerHTML;
                try {
                    btn.disabled = true;
                    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...`;
                    await saveFn();
                    clearSettingsDirty();
                    showAdminToast('تم الحفظ بنجاح');
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

    initSettingsSaveBar();

    wrapSaveBtn('save-identity-btn', async () => {
        await sb_update('site_settings', 1, {
            logo_header: document.getElementById('setting-logo-header')?.value || null,
            logo_footer: document.getElementById('setting-logo-footer')?.value || null,
            site_name: document.getElementById('setting-site-name')?.value?.trim() || null,
            brand_name: document.getElementById('setting-brand-name')?.value?.trim() || null,
            seo_description: document.getElementById('setting-seo-desc')?.value?.trim() || null
        });
    });

    wrapSaveBtn('save-content-btn', async () => {
        await sb_update('site_settings', 1, {
            marquee_text: document.getElementById('setting-marquee-text')?.value?.trim() || null,
            marquee_behavior: document.getElementById('setting-marquee-behavior')?.value || 'running',
            marquee_end_date: document.getElementById('setting-marquee-end-date')?.value || null,
            hero_title: document.getElementById('setting-hero-title')?.value?.trim() || null
        });
    });

    wrapSaveBtn('save-contact-btn', async () => {
        await sb_update('site_settings', 1, {
            address: document.getElementById('setting-address')?.value?.trim() || null,
            footer_phone: document.getElementById('setting-footer-phone')?.value?.trim() || null,
            whatsapp_number: document.getElementById('setting-whatsapp')?.value?.trim() || null,
            footer_phone_visible: document.getElementById('setting-footer-phone-visible')?.checked !== false,
            whatsapp_visible: document.getElementById('setting-whatsapp-visible')?.checked !== false,
            map_latitude: Number(document.getElementById('setting-map-lat')?.value) || null,
            map_longitude: Number(document.getElementById('setting-map-lng')?.value) || null
        });
    });

    wrapSaveBtn('save-shipping-setting-btn', async () => {
        await sb_update('site_settings', 1, {
            bosta_webhook: document.getElementById('setting-bosta-webhook')?.value?.trim() || null,
            bosta_payment_type: document.getElementById('setting-bosta-payment')?.value || 'cod',
            bosta_default_size: Number(document.getElementById('setting-bosta-size')?.value) || 140,
            shipping_custom: document.getElementById('custom-shipping-master-toggle')?.checked || false,
            shipping_type: document.getElementById('custom-shipping-type')?.value || 'flat',
            shipping_flat_rate: Number(document.getElementById('custom-shipping-flat-rate')?.value) || 0
        });
    });

    wrapSaveBtn('save-maintenance-btn', async () => {
        await sb_update('site_settings', 1, {
            maintenance_mode: document.getElementById('maintenance-mode-toggle')?.checked || false,
            maintenance_message: document.getElementById('maintenance-message')?.value?.trim() || null
        });
    });
    } catch (error) {
        console.error('[admin-settings]', error);
        showAdminToast('تعذر تحميل إعدادات الموقع');
    } finally {
        document.getElementById('settings-loading')?.setAttribute('hidden', '');
    }
}

let settingsDirty = false;
function showAdminToast(message) {
    const toast = document.getElementById('admin-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    clearTimeout(showAdminToast.timer);
    showAdminToast.timer = setTimeout(() => toast.classList.remove('visible'), 2600);
}
function markSettingsDirty() {
    settingsDirty = true;
    document.getElementById('settings-save-bar')?.removeAttribute('hidden');
}
function clearSettingsDirty() {
    settingsDirty = false;
    document.getElementById('settings-save-bar')?.setAttribute('hidden', '');
}
function initSettingsSaveBar() {
    const content = document.querySelector('.settings-content');
    content?.addEventListener('input', markSettingsDirty);
    content?.addEventListener('change', markSettingsDirty);
    document.getElementById('settings-save-now')?.addEventListener('click', async () => {
        const active = content?.querySelector('.tab-content-item.active');
        const button = active?.querySelector('button[id^="save-"]');
        if (button) button.click();
        else if (settingsDirty) { clearSettingsDirty(); showAdminToast('تم الحفظ بنجاح'); }
    });
}

function renderSocialLinks() {
    const list = document.getElementById('social-links-list');
    if (!list) return;
    const brands = [{name:'فيسبوك',icon:'fa-brands fa-facebook-f'},{name:'إنستجرام',icon:'fa-brands fa-instagram'},{name:'تيك توك',icon:'fa-brands fa-tiktok'},{name:'يوتيوب',icon:'fa-brands fa-youtube'},{name:'واتساب',icon:'fa-brands fa-whatsapp'}];
    const items = brands.map(brand => sampleSocials.find(item => String(item.name).toLowerCase().includes(brand.name.toLowerCase())) || {id:null,name:brand.name,icon:brand.icon,link:'',visible:false});
    list.innerHTML = items.map(s => `
        <div class="card-item flex-between">
            <div class="flex-align gap-3">
                <i class="${s.icon} text-primary text-lg"></i>
                <div>
                    <strong class="text-dark block">${s.name}</strong>
                    <input class="form-control social-brand-link" data-social-id="${s.id || ''}" value="${escapeAdminHtml(s.link || '', 500)}" placeholder="رابط ${s.name}">
                    <span class="text-subtle text-sm">${s.link}</span>
                </div>
            </div>
            <div class="flex-align gap-3">
                <label class="switch-toggle" title="إظهار/إخفاء">
                    <input type="checkbox" ${s.visible ? 'checked' : ''} onchange="toggleSocialVisible(${s.id})">
                    <span class="slider"></span>
                </label>
                <button class="btn btn-danger-ghost btn-sm" onclick="deleteSocial(${s.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function renderFaqs() {
    const list = document.getElementById('faq-list-container');
    if (!list) return;
    list.innerHTML = sampleFaqs.map(f => `
        <div class="card-item flex-between">
            <div class="flex-1"><strong class="text-primary block font-bold mb-1"><i class="fa-solid fa-question-circle"></i> ${sanitizeFormValue(f.q, 300)}</strong><p class="text-subtle text-sm">${sanitizeFormValue(f.a, 2000)}</p></div>
            <div class="flex-align gap-2"><button class="btn btn-ghost btn-sm" onclick="editFaq(${f.id})"><i class="fa-solid fa-pen"></i> تعديل</button><label class="switch-toggle" title="تفعيل/إخفاء السؤال"><input type="checkbox" ${f.visible ? 'checked' : ''} onchange="toggleFaqVisible(${f.id})"><span class="slider"></span></label><button class="btn btn-danger-ghost btn-sm" onclick="deleteFaq(${f.id})"><i class="fa-solid fa-trash"></i></button></div>
        </div>`).join('');
}

window.toggleSocialVisible = async function(id) {
    const item = sampleSocials.find(s => s.id === id);
    if (item) {
        item.visible = !item.visible;
        try {
            await sb_update('socials', id, { visible: item.visible });
        } catch(e) { alert('خطأ في التحديث'); }
    }
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

window.editFaq = function(id) {
    const item = sampleFaqs.find(f => f.id === id); if (!item) return;
    document.getElementById('faq-q').value = item.q || ''; document.getElementById('faq-a').value = item.a || '';
    document.getElementById('faq-form').dataset.editId = String(id); document.getElementById('faq-modal').classList.remove('hidden');
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


// ==========================================
// BULK PRODUCT IMPORT / UPSERT
// ==========================================
const BULK_HEADERS = ['كود المنتج SKU', 'اسم المنتج', 'القسم', 'السعر', 'السعر قبل الخصم', 'الكمية', 'المقاسات', 'اسم ملف الصورة', 'الوصف'];

function setBulkStatus(message, isError = false) {
    const status = document.getElementById('bulk-import-status');
    if (status) {
        status.textContent = message;
        status.classList.toggle('text-danger', isError);
    }
}

function normalizeFileName(name) {
    return String(name || '').trim().toLowerCase().replace(/\\/g, '/').split('/').pop();
}

function parseBulkNumber(value, fallback = 0) {
    const number = Number(String(value ?? '').replace(/,/g, '').trim());
    return Number.isFinite(number) ? number : fallback;
}

function parseBulkSizes(value) {
    return String(value ?? '').split(/[,،]/).map(item => sanitizeFormValue(item, 100)).filter(Boolean);
}

function generateAutoSku(rowNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 7).toUpperCase();
    return `AUTO-${timestamp}-${rowNumber}-${random}`;
}

function downloadBulkTemplate() {
    if (typeof XLSX === 'undefined') {
        setBulkStatus('مكتبة Excel لسه بتتحمل، جرّب تاني بعد لحظات.', true);
        return;
    }
    const sheet = XLSX.utils.aoa_to_sheet([BULK_HEADERS]);
    sheet['!cols'] = BULK_HEADERS.map(() => ({ wch: 22 }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Products');
    XLSX.writeFile(book, 'products_bulk_template.xlsx');
}

async function readBulkRows(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });
    const headers = (rows.shift() || []).map(value => String(value).trim());
    const indexes = Object.fromEntries(BULK_HEADERS.map(header => [header, headers.indexOf(header)]));
    const missing = BULK_HEADERS.filter(header => indexes[header] < 0);
    if (missing.length) throw new Error(`الأعمدة الناقصة: ${missing.join('، ')}`);
    return rows.map((row, index) => ({
        rowNumber: index + 2,
        sku: sanitizeFormValue(row[indexes['كود المنتج SKU']], 120),
        name: sanitizeFormValue(row[indexes['اسم المنتج']], 300),
        category: sanitizeFormValue(row[indexes['القسم']], 150),
        price: parseBulkNumber(row[indexes['السعر']]),
        salePrice: parseBulkNumber(row[indexes['السعر قبل الخصم']], 0),
        stock: Math.max(0, Math.floor(parseBulkNumber(row[indexes['الكمية']]))),
        sizes: parseBulkSizes(row[indexes['المقاسات']]),
        imageName: normalizeFileName(row[indexes['اسم ملف الصورة']]),
        desc: sanitizeFormValue(row[indexes['الوصف']], 5000)
    })).filter(row => row.sku || row.name);
}

async function importBulkProducts() {
    const permissionResponse = await fetch('/api/admin?action=bulk-import', { credentials: 'include' });
    if (!permissionResponse.ok) return setBulkStatus('الرفع المجمع متاح للأدمن فقط.', true);
    const excelInput = document.getElementById('bulk-excel-file');
    const imagesInput = document.getElementById('bulk-image-files');
    const button = document.getElementById('start-bulk-import');
    if (!excelInput?.files?.[0]) return setBulkStatus('اختار ملف Excel الأول.', true);
    if (typeof XLSX === 'undefined') return setBulkStatus('مكتبة Excel لسه بتتحمل، جرّب تاني بعد لحظات.', true);

    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    window.BULK_IMPORT_MODE = true;
    setBulkStatus('جاري قراءة الملف وتجهيز الصور...');
    try {
        const rows = await readBulkRows(excelInput.files[0]);
        const filesByName = new Map(Array.from(imagesInput?.files || []).map(file => [normalizeFileName(file.name), file]));
        const existing = await sb_fetch('products') || [];
        const bySku = new Map(existing.filter(product => product.sku).map(product => [String(product.sku).trim().toLowerCase(), product]));
        let added = 0;
        let updated = 0;
        const warnings = [];

        for (const row of rows) {
            if (!row.name || row.price <= 0) {
                warnings.push(`السطر ${row.rowNumber}: لازم اسم المنتج والسعر يكونوا صحيحين.`);
                continue;
            }
            if (!row.sku) {
                row.sku = generateAutoSku(row.rowNumber);
                warnings.push(`السطر ${row.rowNumber}: تم إنشاء SKU تلقائي: ${row.sku}`);
            }
            const oldProduct = bySku.get(row.sku.toLowerCase());
            let images = oldProduct?.images || [];
            if (row.imageName) {
                const imageFile = filesByName.get(row.imageName);
                if (!imageFile) {
                    warnings.push(`السطر ${row.rowNumber}: الصورة ${row.imageName} مش موجودة، تم الإبقاء على الصور القديمة.`);
                } else {
                    const imageUrl = await sb_upload(imageFile);
                    images = [{ url: imageUrl, main: true }];
                }
            }
            const product = {
                name: row.name,
                sku: row.sku,
                price: row.price,
                salePrice: row.salePrice > 0 ? row.salePrice : '',
                stock: row.stock,
                stockThreshold: oldProduct?.stockThreshold || 5,
                bostaSize: oldProduct?.bostaSize || 0,
                category: row.category || 'بدون قسم',
                bestseller: oldProduct?.bestseller || false,
                desc: row.desc,
                sizes: row.sizes,
                images
            };
            if (oldProduct) {
                await sb_update('products', oldProduct.id, product);
                updated++;
            } else {
                await sb_insert('products', product);
                bySku.set(row.sku.toLowerCase(), { ...product, id: `pending-${row.rowNumber}` });
                added++;
            }
        }
        sampleProducts = await sb_fetch('products') || [];
        renderProducts(sampleProducts);
        const warningText = warnings.length ? `\nتنبيهات:\n${warnings.join('\n')}` : '';
        setBulkStatus(`تم بنجاح: إضافة ${added} وتحديث ${updated}.${warningText}`);
    } catch (error) {
        console.error('[bulk-import]', error);
        setBulkStatus(`فشل الرفع: ${error.message}`, true);
    } finally {
        window.BULK_IMPORT_MODE = false;
        button.disabled = false;
        button.removeAttribute('aria-busy');
    }
}

function initBulkProductImport() {
    document.getElementById('open-bulk-import')?.addEventListener('click', () => document.getElementById('bulk-import-panel')?.classList.remove('hidden'));
    document.getElementById('close-bulk-import')?.addEventListener('click', () => document.getElementById('bulk-import-panel')?.classList.add('hidden'));
    document.getElementById('download-products-template')?.addEventListener('click', downloadBulkTemplate);
    document.getElementById('start-bulk-import')?.addEventListener('click', importBulkProducts);
}


// ==========================================
// STAFF ACCOUNTS MANAGEMENT
// ==========================================
let staffAccounts = [];

async function fetchStaffAccounts() {
    const response = await fetch('/api/admin?action=staff', { credentials: 'include' });
    if (!response.ok) throw new Error('تعذر تحميل الموظفين');
    return response.json();
}

function renderStaffAccounts() {
    const list = document.getElementById('staff-list-container');
    if (!list) return;
    if (!staffAccounts.length) { list.textContent = 'لا يوجد موظفون مضافون حتى الآن.'; return; }
    list.innerHTML = staffAccounts.map(staff => `
        <div class="card-item flex-between">
            <div class="staff-card-identity">${staff.avatar_url ? `<img class="staff-avatar" src="${escapeAdminHtml(staff.avatar_url, 500)}" alt="">` : '<span class="staff-avatar staff-avatar-fallback"><i class="fa-solid fa-user"></i></span>'}<div><strong class="text-primary block">${escapeAdminHtml(staff.display_name || '', 100)}</strong><span class="text-subtle text-sm">${escapeAdminHtml(staff.phone, 30)} · ${staff.is_active ? 'نشط' : 'موقوف'} · <span class="presence-dot ${staff.is_online ? 'online' : ''}"></span>${staff.is_online ? 'أونلاين' : `آخر ظهور: ${escapeAdminHtml(staff.last_seen_at ? new Date(staff.last_seen_at).toLocaleString('ar-EG') : 'غير مسجل', 80)}`}</span></div></div>
            <div class="flex-align gap-2"><button type="button" class="btn btn-ghost btn-sm" data-edit-staff="${staff.id}"><i class="fa-solid fa-pen"></i> تعديل</button><button type="button" class="btn btn-danger-ghost btn-sm" data-delete-staff="${staff.id}"><i class="fa-solid fa-trash"></i></button></div>
        </div>`).join('');
}

function resetStaffForm() {
    document.getElementById('staff-form')?.reset();
    document.getElementById('staff-edit-id').value = '';
    document.getElementById('staff-active').checked = true;
    document.getElementById('staff-role-template').value = 'custom';
    document.getElementById('staff-avatar-url').value = '';
    document.getElementById('staff-avatar-preview').hidden = true;
    document.getElementById('staff-force-logout').classList.add('hidden');
    document.getElementById('staff-device-history').hidden = true;
    document.querySelectorAll('#staff-permissions input[type="checkbox"]').forEach(input => { input.checked = false; });
}

function fillStaffForm(staff) {
    document.getElementById('staff-edit-id').value = staff?.id || '';
    document.getElementById('staff-phone').value = staff?.phone || '';
    document.getElementById('staff-name').value = staff?.display_name || '';
    document.getElementById('staff-password').value = '';
    document.getElementById('staff-active').checked = staff?.is_active !== false;
    document.getElementById('staff-role-template').value = 'custom';
    document.getElementById('staff-avatar-url').value = staff?.avatar_url || '';
    const preview = document.getElementById('staff-avatar-preview');
    preview.hidden = !staff?.avatar_url;
    preview.innerHTML = staff?.avatar_url ? `<img class="staff-avatar" src="${escapeAdminHtml(staff.avatar_url, 500)}" alt="">` : '';
    document.getElementById('staff-force-logout').classList.remove('hidden');
    const deviceHistory = document.getElementById('staff-device-history');
    deviceHistory.hidden = false;
    deviceHistory.innerHTML = `<strong><i class="fa-solid fa-shield-halved"></i> آخر نشاط أمني</strong><span>آخر دخول: ${escapeAdminHtml(staff.last_login_at ? new Date(staff.last_login_at).toLocaleString('ar-EG') : 'غير مسجل', 100)}</span><span>الجهاز: ${escapeAdminHtml(staff.last_user_agent || 'غير مسجل', 500)}</span>`;
    const permissions = staff?.permissions && typeof staff.permissions === 'object' ? Object.keys(staff.permissions).filter(key => staff.permissions[key]) : (Array.isArray(staff?.permissions) ? staff.permissions : []);
    document.querySelectorAll('#staff-permissions input[type="checkbox"]').forEach(input => { input.checked = permissions.includes(input.value); });
    document.getElementById('tab-staff')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

let staffAccountsInitialized = false;
async function initStaffAccounts() {
    if (staffAccountsInitialized) return;
    staffAccountsInitialized = true;
    try { staffAccounts = await fetchStaffAccounts(); renderStaffAccounts(); } catch (error) { const status = document.getElementById('staff-status'); if (status) status.textContent = error.message; }
    document.querySelectorAll('[data-permission-preset]').forEach(button => button.addEventListener('click', () => {
        const type = button.dataset.permissionPreset;
        const keys = type === 'all' ? null : type === 'shipping' ? ['edit_shipping','edit_bosta_settings','create_retry_bosta_shipment','confirm_packaging','print_bosta_waybill','request_bosta_pickup','cancel_bosta_shipment'] : ['view_products','create_products','edit_products_stock','archive_products','upload_product_images'];
        document.querySelectorAll('#staff-permissions input[type="checkbox"]').forEach(input => { input.checked = keys ? keys.includes(input.value) : true; });
    }));
    document.querySelectorAll('.permission-card summary').forEach(summary => summary.addEventListener('click', () => markSettingsDirty()));
    document.getElementById('staff-role-template')?.addEventListener('change', applyStaffRoleTemplate);
    document.getElementById('staff-active')?.addEventListener('change', event => { const label = event.target.closest('.switch-toggle')?.querySelector('.switch-label'); if (label) label.textContent = event.target.checked ? 'نشط' : 'موقوف'; });
    document.querySelectorAll('.password-toggle').forEach(button => button.addEventListener('click', () => {
        const input = document.getElementById(button.dataset.passwordTarget);
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
        button.querySelector('i')?.classList.toggle('fa-eye-slash', input.type === 'text');
        button.querySelector('i')?.classList.toggle('fa-eye', input.type === 'password');
    }));
    document.getElementById('staff-avatar-file')?.addEventListener('change', previewStaffAvatar);
    document.getElementById('staff-force-logout')?.addEventListener('click', forceLogoutSelectedStaff);
    document.getElementById('staff-reset-btn')?.addEventListener('click', resetStaffForm);
    document.getElementById('staff-list-container')?.addEventListener('click', event => {
        const edit = event.target.closest('[data-edit-staff]');
        const remove = event.target.closest('[data-delete-staff]');
        if (edit) fillStaffForm(staffAccounts.find(item => String(item.id) === edit.dataset.editStaff));
        if (remove) deleteStaffAccount(remove.dataset.deleteStaff);
    });
    document.getElementById('staff-form')?.addEventListener('submit', saveStaffAccount);
}

async function saveStaffAccount(event) {
    event.preventDefault();
    const id = document.getElementById('staff-edit-id').value;
    try { await uploadStaffAvatar(); } catch (error) { document.getElementById('staff-status').textContent = error.message || 'تعذر رفع الصورة الشخصية.'; return; }
    const permissions = Object.fromEntries([...document.querySelectorAll('#staff-permissions input[type="checkbox"]:checked')].map(input => [input.value, true]));
    const payload = { phone: sanitizeFormValue(document.getElementById('staff-phone').value, 30), display_name: sanitizeFormValue(document.getElementById('staff-name').value, 100), permissions, avatar_url: document.getElementById('staff-avatar-url').value || null, is_active: document.getElementById('staff-active').checked };
    const password = document.getElementById('staff-password').value;
    if (password) payload.password = password;
    if (!id && !password) { document.getElementById('staff-status').textContent = 'اكتب كلمة سر لا تقل عن 8 حروف عند إضافة موظف.'; return; }
    const response = await fetch(`/api/admin?action=staff${id ? `&id=${encodeURIComponent(id)}` : ''}`, { method: id ? 'PATCH' : 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { const error = await response.json().catch(() => ({})); document.getElementById('staff-status').textContent = error.error || 'تعذر حفظ بيانات الموظف'; return; }
    staffAccounts = await fetchStaffAccounts(); renderStaffAccounts(); resetStaffForm(); document.getElementById('staff-status').textContent = 'تم حفظ بيانات الموظف بنجاح.'; showAdminToast('تم حفظ الموظف بنجاح');
}

const STAFF_ROLE_TEMPLATES = {
    customer_service: ['view_orders', 'update_order_status', 'edit_customer_data', 'view_complaints', 'update_complaint_status'],
    warehouse: ['view_products', 'create_products', 'edit_products_stock', 'archive_products', 'upload_product_images', 'view_categories'],
    shipping: ['view_orders', 'update_order_status', 'edit_shipping', 'edit_bosta_settings', 'create_retry_bosta_shipment', 'confirm_packaging', 'print_bosta_waybill', 'request_bosta_pickup', 'cancel_bosta_shipment'],
    content: ['view_landing_settings', 'edit_general_landing_settings', 'edit_identity_seo', 'edit_hero_catalog', 'edit_contact_social', 'edit_faq', 'edit_maintenance']
};
function applyStaffRoleTemplate(event) {
    const permissions = STAFF_ROLE_TEMPLATES[event.target.value];
    if (!permissions) return;
    document.querySelectorAll('#staff-permissions input[type="checkbox"]').forEach(input => { input.checked = permissions.includes(input.value); });
    markSettingsDirty();
}
function previewStaffAvatar(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const preview = document.getElementById('staff-avatar-preview');
    preview.hidden = false;
    preview.innerHTML = `<img class="staff-avatar" src="${URL.createObjectURL(file)}" alt="معاينة الصورة">`;
    markSettingsDirty();
}
async function uploadStaffAvatar() {
    const file = document.getElementById('staff-avatar-file')?.files?.[0];
    if (!file) return document.getElementById('staff-avatar-url')?.value || null;
    const url = await sb_upload(file, 'public-assets');
    document.getElementById('staff-avatar-url').value = url;
    return url;
}
async function forceLogoutSelectedStaff() {
    const id = document.getElementById('staff-edit-id').value;
    if (!id || !confirm('سيتم إبطال كل جلسات الموظف الحالية. هل تريد المتابعة؟')) return;
    const response = await fetch(`/api/admin?action=staff&operation=force-logout&id=${encodeURIComponent(id)}`, { method: 'POST', credentials: 'include' });
    if (!response.ok) { document.getElementById('staff-status').textContent = 'تعذر طرد الموظف من الأجهزة.'; return; }
    document.getElementById('staff-status').textContent = 'تم إبطال جلسات الموظف من كل الأجهزة.';
    showAdminToast('تم تسجيل الخروج الإجباري');
}

async function deleteStaffAccount(id) {
    if (!confirm('هل أنت متأكد من حذف الموظف؟')) return;
    const response = await fetch(`/api/admin?action=staff&id=${encodeURIComponent(id)}`, { method: 'DELETE', credentials: 'include' });
    if (!response.ok) return;
    staffAccounts = await fetchStaffAccounts();
    renderStaffAccounts();
}


async function reviewProfileRequest(id, status) {
    const adminReason = status === 'rejected' ? prompt('سبب الرفض:') || '' : '';
    await fetch(`/api/admin?action=profile-requests&id=${encodeURIComponent(id)}`, { method: 'PATCH', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ status, admin_reason: adminReason }) });
    showAdminToast('تم تحديث الطلب');
}
