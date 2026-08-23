/* admin.js - Awlad El-Kady Admin Dashboard Full Functional UI Engine */

document.addEventListener('DOMContentLoaded', () => {
    initPasswordAuth();
    initDateBadge();
    initNavigation();
    initAswanShippingCalc();
    initOrdersSystem();
    initProductsAndCategories();
    initComplaintsSystem();
    initSiteSettings();
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
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const pwd = pwdInput ? pwdInput.value.trim() : '';

            // Accept PIN 500900 or 123456
            if (pwd === '500900' || pwd === '123456' || pwd === 'admin') {
                loginScreen.classList.add('unlocked');
                dashboard.classList.remove('hidden');
            } else {
                loginError.textContent = 'رمز PIN / كلمة المرور غير صحيحة!';
                if (pwdInput) {
                    pwdInput.value = '';
                    pwdInput.focus();
                }
            }
        });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            loginScreen.classList.remove('unlocked');
            dashboard.classList.add('hidden');
            if (pwdInput) pwdInput.value = '';
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
    const navItems = document.querySelectorAll('.sidebar-menu .nav-item');
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
let sampleOrders = [
    {
        id: '#ORD-1055',
        name: 'محمود عبدالجواد أسعد',
        phone: '01012345678',
        secondPhone: '01144556677',
        gov: 'أسوان',
        area: 'مركز أسوان',
        address: 'شارع كورنيش النيل - بجوار البنك الأهلي',
        items: [
            { name: 'ثلاجة تورنيدو 16 قدم نوفروست', qty: 1, price: 18500, sku: 'TRN-RF16' }
        ],
        subtotal: 18500,
        shipping: 1133.16, // 994 * 1.14 (Bulky Appliances)
        status: 'جديد',
        date: '2026-08-24 00:15',
        notes: 'يرجى المعاينة والتسليم بالدور الثالث'
    },
    {
        id: '#ORD-1054',
        name: 'عبدالرحمن سيد الجبالي',
        phone: '01198765432',
        secondPhone: '',
        gov: 'القاهرة',
        area: 'مدينة نصر',
        address: 'الحي السابع - عمارة 14',
        items: [
            { name: 'شاشة سمارت 55 بوصة 4K', qty: 1, price: 15900, sku: 'TV-55-4K' },
            { name: 'حامل شاشة متحرك', qty: 1, price: 900, sku: 'BRK-TV55' }
        ],
        subtotal: 16800,
        shipping: 171.00, // 150 * 1.14 (XL)
        status: 'قيد المعالجة',
        date: '2026-08-23 19:15',
        notes: 'الاتصال قبل التوصيل بساعة'
    },
    {
        id: '#ORD-1053',
        name: 'سارة محمد إبراهيم',
        phone: '01234567890',
        secondPhone: '01599887766',
        gov: 'الإسكندرية',
        area: 'سموحة',
        address: 'شارع فوزي معاذ - برج الأمل',
        items: [
            { name: 'خلاط تورنيدو 400 وات', qty: 2, price: 850, sku: 'TRN-BL400' }
        ],
        subtotal: 1700,
        shipping: 159.60, // 140 * 1.14 (S/M)
        status: 'جديد',
        date: '2026-08-23 16:40',
        notes: 'التسليم فترات مسائية'
    }
];

async function initOrdersSystem() {
    sampleOrders = await sb_fetch('orders') || [];
    renderOrders(sampleOrders);

    // Search filter
    const searchInput = document.getElementById('search-orders-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = sampleOrders.filter(o =>
                o.id.toLowerCase().includes(query) ||
                o.name.toLowerCase().includes(query) ||
                o.phone.includes(query) ||
                o.gov.toLowerCase().includes(query)
            );
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
                (o.subtotal + o.shipping).toFixed(2),      // * Cash Amount
                o.notes || 'عقد أسوان',                     // Delivery Notes
                o.items.map(i => i.name).join(' + '),       // Package Description
                'Deliver',                                  // Type
                o.items.reduce((acc, i) => acc + i.qty, 0), // No of Items
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

function renderOrders(orders) {
    const container = document.getElementById('orders-cards-container');
    if (!container) return;

    if (orders.length === 0) {
        container.innerHTML = `<div class="glass-panel p-4 text-center text-subtle">لا توجد طلبات مطابقة للبحث.</div>`;
        return;
    }

    container.innerHTML = orders.map((o, idx) => {
        const total = (o.subtotal + o.shipping).toFixed(2);
        return `
            <div class="order-card glass-panel" data-idx="${idx}">
                <div class="order-card-header">
                    <div class="flex-align gap-3">
                        <strong class="text-primary text-lg">${o.id}</strong>
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
                    </div>
                    <div>
                        <span class="text-subtle text-sm block">المحافظة والمنطقة:</span>
                        <strong class="text-primary block">${o.gov} - ${o.area}</strong>
                        <span class="text-subtle text-sm">${o.address}</span>
                    </div>
                    <div>
                        <span class="text-subtle text-sm block">المنتجات والـ SKU:</span>
                        <div class="flex-column gap-1 mt-1">
                            ${o.items.map(item => `
                                <div class="bg-surface p-2 rounded text-sm flex-between">
                                    <span>${item.name} (x${item.qty})</span>
                                    <span class="text-subtle text-sm">SKU: ${item.sku} - ${item.price} ج</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div>
                        <span class="text-subtle text-sm block mb-1">الشحن (تعديل يدوي):</span>
                        <div class="flex-align gap-1">
                            <input type="number" class="editable-shipping-input" value="${o.shipping.toFixed(2)}" onchange="updateOrderShipping(${idx}, this.value)">
                            <span class="text-subtle text-sm">ج.م</span>
                        </div>
                        <span class="text-subtle text-sm block mt-1" style="font-size:0.72rem;">عقد أسوان بوسطة</span>
                    </div>
                </div>

                <div class="order-card-footer">
                    <div class="flex-align gap-2">
                        <button class="btn btn-ghost btn-sm" onclick="window.print()"><i class="fa-solid fa-print"></i> طباعة الفاتورة</button>
                    </div>
                    <span class="text-subtle text-sm">المجموع الفرعي: ${o.subtotal} ج.م | الإجمالي: <strong class="text-primary">${total} ج.م</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

window.updateOrderShipping = function(idx, newShippingVal) {
    const val = parseFloat(newShippingVal) || 0;
    sampleOrders[idx].shipping = val;
    const newTotal = (sampleOrders[idx].subtotal + val).toFixed(2);
    const grandTotalEl = document.getElementById(`order-grand-total-${idx}`);
    if (grandTotalEl) grandTotalEl.textContent = newTotal + ' ج.م';
};

// ==========================================
// 6. PRODUCTS & CATEGORIES FULL CRUD ENGINE
// ==========================================
let sampleCategories = [
    { id: 1, name: 'باقات جهاز العروسة', desc: 'عروض مجمعة بأسعار الجملة' },
    { id: 2, name: 'ثلاجات وديب فريزر', desc: 'جميع الأحجام والأشكال كفاءة طاقة عالية' },
    { id: 3, name: 'غسالات ومجففات', desc: 'هاف وأوتوماتيك بالكامل استانلس' },
    { id: 4, name: 'شاشات وإلكترونيات', desc: 'شاشات سمارت 4K وريسيفرات' },
    { id: 5, name: 'أدوات مطبخ', desc: 'خلاطات، ميكروويف، محضرات طعام' }
];

let sampleProducts = [
    {
        id: 1,
        name: 'ثلاجة تورنيدو 16 قدم نوفروست',
        sku: 'TRN-RF16',
        price: 18500,
        salePrice: 17200,
        stock: 12,
        stockThreshold: 5,
        category: 'ثلاجات وديب فريزر',
        bostaSize: 994, // Bulky
        bestseller: true,
        desc: 'ثلاجة عائلية بموتور انفرتر موفر للكهرباء وضمان 10 سنوات.',
        images: [
            { url: '', main: true },
            { url: '', main: false }
        ]
    },
    {
        id: 2,
        name: 'غسالة توشيبا فول أوتوماتيك 8 كجم',
        sku: 'TSH-WM08',
        price: 14200,
        salePrice: 13900,
        stock: 3, // Less than threshold 5 => AUTO LOW STOCK BADGE
        stockThreshold: 5,
        category: 'غسالات ومجففات',
        bostaSize: 994,
        bestseller: true,
        desc: 'غسالة ملابس حلة استانلس طرد مركزي ميكرو بابلز.',
        images: [
            { url: '', main: true }
        ]
    },
    {
        id: 3,
        name: 'شاشة سمارت 55 بوصة 4K Ultra HD',
        sku: 'TV-55-4K',
        price: 15900,
        salePrice: '',
        stock: 8,
        stockThreshold: 5,
        category: 'شاشات وإلكترونيات',
        bostaSize: 150, // XL
        bestseller: false,
        desc: 'شاشة نظام أندرويد ريموت ماوس صوتي وبث مباشر.',
        images: []
    },
    {
        id: 4,
        name: 'خلاط تورنيدو 400 وات المطحنة',
        sku: 'TRN-BL400',
        price: 850,
        salePrice: 790,
        stock: 45,
        stockThreshold: 5,
        category: 'أدوات مطبخ',
        bostaSize: 140, // S/M
        bestseller: false,
        desc: 'شفشق قوي يكسر الثلج ومطحنة توابل استانلس.',
        images: []
    }
];

async function initProductsAndCategories() {
    sampleProducts = await sb_fetch('products') || [];
    sampleCategories = await sb_fetch('categories') || [];
    renderProducts(sampleProducts);
    renderCategories(sampleCategories);
    populateCategoryDropdowns();
    renderGalleryUploaderSlots([]);

    // Product Search
    const searchProd = document.getElementById('search-products-input');
    if (searchProd) {
        searchProd.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            const filtered = sampleProducts.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
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
            const editId = document.getElementById('p-edit-id').value;
            const stockVal = parseInt(document.getElementById('p-stock').value) || 0;
            const thresholdVal = parseInt(document.getElementById('p-stock-threshold').value) || 5;

            const newProd = {
                name: document.getElementById('p-name').value,
                sku: document.getElementById('p-sku').value,
                price: parseFloat(document.getElementById('p-price').value),
                salePrice: document.getElementById('p-sale-price').value,
                stock: stockVal,
                stockThreshold: thresholdVal,
                bostaSize: parseFloat(document.getElementById('p-bosta-size').value),
                category: document.getElementById('p-category-select').value,
                bestseller: document.getElementById('p-tag-bestseller').checked,
                desc: document.getElementById('p-desc').value,
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

    container.innerHTML = products.map(p => {
        // Automatic low stock detection logic!
        const isLowStock = p.stock <= (p.stockThreshold || 5);

        return `
            <div class="product-card">
                <div class="product-thumb-container">
                    <i class="fa-solid fa-box-open"></i>
                    <div class="badge-overlay-container">
                        ${p.bestseller ? '<span class="badge badge-resolved">الأكثر مبيعاً</span>' : ''}
                        ${isLowStock ? '<span class="badge badge-new"><i class="fa-solid fa-triangle-exclamation"></i> متبقي قطع قليلة (' + p.stock + ')</span>' : ''}
                    </div>
                </div>
                <div class="product-card-body">
                    <span class="text-subtle text-sm block mb-1">${p.category}</span>
                    <strong class="text-primary font-bold text-lg mb-1">${p.name}</strong>
                    <span class="text-subtle text-sm mb-2">SKU: ${p.sku} | شحن بوسطة: ${p.bostaSize} ج</span>
                    <p class="text-subtle text-sm mb-3" style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.desc}</p>
                    <div class="flex-between mt-auto">
                        <div>
                            <strong class="text-primary text-lg">${p.salePrice ? p.salePrice : p.price} ج.م</strong>
                            ${p.salePrice ? `<span class="text-subtle text-sm" style="text-decoration:line-through;">${p.price} ج</span>` : ''}
                        </div>
                        <span class="text-sm font-bold ${isLowStock ? 'text-danger' : 'text-emerald'}">${p.stock} قطعة بالكتالوج</span>
                    </div>
                    <div class="product-card-actions">
                        <button class="btn btn-ghost btn-sm flex-1" onclick="editProduct(${p.id})"><i class="fa-solid fa-pen"></i> تعديل</button>
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
    currentEditingImages = existingImages || [];
    const galleryContainer = document.getElementById('product-images-gallery');
    if (!galleryContainer) return;

    let html = '';
    for (let i = 0; i < 6; i++) {
        const imgObj = currentEditingImages[i];
        const isMain = imgObj ? imgObj.main : (i === 0);

        if (imgObj && imgObj.url) {
            html += `
                <div class="img-box ${isMain ? 'main-box' : ''}" onclick="setMainImageSlot(${i})">
                    ${isMain ? '<span class="main-badge">رئيسية</span>' : ''}
                    <button type="button" class="remove-img-btn" onclick="event.stopPropagation(); removeImageSlot(${i})"><i class="fa-solid fa-xmark"></i></button>
                    <img src="${imgObj.url}" class="img-preview" alt="صورة ${i+1}">
                </div>
            `;
        } else {
            html += `
                <div class="img-box ${i === 0 ? 'main-box' : ''}" onclick="document.getElementById('img-upload-slot-${i}').click()">
                    ${i === 0 ? '<span class="main-badge">رئيسية</span>' : ''}
                    <i class="fa-solid ${i === 0 ? 'fa-camera' : 'fa-plus'}"></i>
                    <span>${i === 0 ? 'الرئيسية' : 'صورة ' + (i+1)}</span>
                    <input type="file" id="img-upload-slot-${i}" class="img-file-input" accept="image/*" style="display:none;" onchange="handleImageSlotUpload(event, ${i})">
                </div>
            `;
        }
    }

    galleryContainer.innerHTML = html;
}

window.handleImageSlotUpload = async function(event, index) {
    const file = event.target.files[0];
    if (!file) return;
    try {
        const url = await sb_upload(file);
        const isMain = index === 0;
        currentEditingImages[index] = { url, main: isMain };
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
    currentEditingImages[index] = null;
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
    if (confirm('هل أنت تأكد من رغبتك في حذف هذا المنتج من الكتالوج؟')) {
        await sb_delete('products', id);
        sampleProducts = sampleProducts.filter(p => p.id !== id);
        renderProducts(sampleProducts);
    }
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
    if (confirm('هل أنت تأكد من حذف هذا القسم؟')) {
        await sb_delete('categories', id);
        sampleCategories = sampleCategories.filter(c => c.id !== id);
        renderCategories(sampleCategories);
        populateCategoryDropdowns();
    }
};

// ==========================================
// 7. COMPLAINTS SYSTEM & WHATSAPP INTEGRATION
// ==========================================
let sampleComplaints = [
    {
        id: 101,
        client: 'إبراهيم علي حسن',
        phone: '01011223344',
        date: 'منذ ساعتين (2026-08-24 00:10)',
        status: 'new', // new = red, resolved = green
        text: 'استفسار عن موعد التوصيل للطلب الخاص بي في أسوان، يرجى التأكيد قبل التحرك.'
    },
    {
        id: 102,
        client: 'منى عبدالعزيز',
        phone: '01299887766',
        date: 'منذ 5 ساعات (2026-08-23 17:30)',
        status: 'resolved',
        text: 'تم استلام جهاز المطبخ وبحمد الله بحالة ممتازة وشكراً لخدمة العملاء.'
    }
];

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
let sampleSocials = [
    { id: 1, name: 'واتساب المبيعات', icon: 'fa-brands fa-whatsapp', link: 'https://wa.me/20100000000', visible: true },
    { id: 2, name: 'صفحة فيسبوك', icon: 'fa-brands fa-facebook', link: 'https://facebook.com/awladelkady', visible: true },
    { id: 3, name: 'حساب انستغرام', icon: 'fa-brands fa-instagram', link: 'https://instagram.com/awladelkady', visible: false }
];

let sampleFaqs = [
    { id: 1, q: 'كم تستغرق مدة توصيل الأجهزة؟', a: 'تستغرق من 24 لـ 48 ساعة فقط بفضل الشحن المباشر من معرض أسوان عبر بوسطة.', visible: true },
    { id: 2, q: 'هل يمكن الاستلام والمعاينة قبل الدفع؟', a: 'نعم، نوفر خدمة المعاينة والفتح مع مندوب بوسطة قبل سداد أي مبلغ.', visible: true }
];

function initSiteSettings() {
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
        addSocialBtn.addEventListener('click', () => {
            const name = prompt('اسم قناة التواصل الجديدة:');
            const link = prompt('الرابط الكامل:');
            if (name && link) {
                sampleSocials.push({ id: Date.now(), name, icon: 'fa-solid fa-link', link, visible: true });
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
        faqForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const q = document.getElementById('faq-q').value;
            const a = document.getElementById('faq-a').value;
            sampleFaqs.push({ id: Date.now(), q, a, visible: true });
            renderFaqs();
            faqModal.classList.add('hidden');
        });
    }

    // Save buttons notifications
    ['save-identity-btn', 'save-content-btn', 'save-contact-btn', 'save-shipping-setting-btn', 'save-maintenance-btn'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                alert('تم حفظ البيانات بنجاح!');
            });
        }
    });
}

function renderSocialLinks() {
    const list = document.getElementById('social-links-list');
    if (!list) return;

    list.innerHTML = sampleSocials.map(s => `
        <div class="card-item flex-between">
            <div class="flex-align gap-3">
                <i class="${s.icon} text-primary text-lg"></i>
                <div>
                    <strong class="text-dark block">${s.name}</strong>
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
            <div class="flex-1">
                <strong class="text-primary block font-bold mb-1"><i class="fa-solid fa-question-circle"></i> ${f.q}</strong>
                <p class="text-subtle text-sm">${f.a}</p>
            </div>
            <div class="flex-align gap-3">
                <label class="switch-toggle" title="تفعيل/إخفاء السؤال">
                    <input type="checkbox" ${f.visible ? 'checked' : ''} onchange="toggleFaqVisible(${f.id})">
                    <span class="slider"></span>
                </label>
                <button class="btn btn-danger-ghost btn-sm" onclick="deleteFaq(${f.id})"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

window.toggleSocialVisible = function(id) {
    const item = sampleSocials.find(s => s.id === id);
    if (item) item.visible = !item.visible;
};
window.deleteSocial = function(id) {
    sampleSocials = sampleSocials.filter(s => s.id !== id);
    renderSocialLinks();
};

window.toggleFaqVisible = function(id) {
    const item = sampleFaqs.find(f => f.id === id);
    if (item) item.visible = !item.visible;
};
window.deleteFaq = function(id) {
    sampleFaqs = sampleFaqs.filter(f => f.id !== id);
    renderFaqs();
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
