/**
 * ==========================================
 *  Awlad El-Kady — Supabase Unified Client
 *  Provides: select, insert, insertReturn, update, delete, upload
 * ==========================================
 */
let adminRefreshPromise = null;

async function refreshAdminSession() {
  if (!adminRefreshPromise) {
    adminRefreshPromise = fetch('/api/admin-refresh', { method: 'POST', credentials: 'include' })
      .then(response => response.ok)
      .catch(() => false)
      .finally(() => { adminRefreshPromise = null; });
  }
  return adminRefreshPromise;
}

window.adminFetch = async function adminFetch(url, options = {}) {
  const requestOptions = { ...options, credentials: 'include' };
  let response = await fetch(url, requestOptions);
  if (response.status !== 401 || String(url).includes('/api/admin-refresh')) return response;
  const refreshed = await refreshAdminSession();
  if (!refreshed) return response;
  return fetch(url, requestOptions);
};

const Supabase = {
  get url() { return SUPABASE_CONFIG.url; },
  get key() { return SUPABASE_CONFIG.anonKey; },
  get headers() {
    const token = sessionStorage.getItem('supabase_access_token');
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_CONFIG.anonKey,
      'Authorization': `Bearer ${token || SUPABASE_CONFIG.anonKey}`
    };
  },

  async signIn(email, password) {
    const res = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: this.key },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || data.msg || 'بيانات الدخول غير صحيحة');
    sessionStorage.setItem('supabase_access_token', data.access_token);
    if (data.refresh_token) sessionStorage.setItem('supabase_refresh_token', data.refresh_token);
    return data;
  },

  signOut() {
    sessionStorage.removeItem('supabase_access_token');
    sessionStorage.removeItem('supabase_refresh_token');
  },

  // ── READ ──────────────────────────────────────────────────────
  async rpc(fn, params = {}) {
    const res = await fetch(`${this.url}/rest/v1/rpc/${fn}`, {
      method: 'POST', headers: this.headers, body: JSON.stringify(params)
    });
    if (!res.ok) throw new Error(`[Supabase rpc:${fn}] ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  },

  async select(table, query = '') {
    if (window.ADMIN_API) {
      const res = await window.adminFetch(`/api/admin?table=${encodeURIComponent(table)}&action=select&query=${encodeURIComponent(query)}`);
      if (!res.ok) throw new Error(`[Admin select:${table}] ${await res.text()}`);
      return res.json();
    }
    const sep = query ? '&' : '';
    const res = await fetch(`${this.url}/rest/v1/${table}?select=*${sep}${query}`, {
      headers: this.headers
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Supabase select:${table}] ${err}`);
    }
    return res.json();
  },

  // ── INSERT (return=minimal) ───────────────────────────────────
  async insert(table, data) {
    if (window.ADMIN_API) {
      const res = await window.adminFetch(`/api/admin?table=${encodeURIComponent(table)}&action=insert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(`[Admin insert:${table}] ${await res.text()}`);
      return true;
    }
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Supabase insert:${table}] ${err}`);
    }
    return true;
  },

  // ── INSERT and get back the created row ───────────────────────
  async insertReturn(table, data) {
    if (window.ADMIN_API) {
      const res = await window.adminFetch(`/api/admin?table=${encodeURIComponent(table)}&action=insertReturn`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error(`[Admin insertReturn:${table}] ${await res.text()}`);
      const rows = await res.json();
      return Array.isArray(rows) ? rows[0] : rows;
    }
    const res = await fetch(`${this.url}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this.headers, 'Prefer': 'return=representation' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`[Supabase insertReturn:${table}] ${await res.text()}`);
    const rows = await res.json();
    return rows[0];
  },

  // ── UPDATE ────────────────────────────────────────────────────
  async update(table, id, data) {
    if (window.ADMIN_API) {
      const res = await window.adminFetch(`/api/admin?table=${encodeURIComponent(table)}&action=update&id=${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!res.ok) throw new Error(`[Admin update:${table}] ${await res.text()}`);
      return true;
    }
    const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'PATCH',
      headers: { ...this.headers, 'Prefer': 'return=minimal' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Supabase update:${table}] ${err}`);
    }
    return true;
  },

  // ── DELETE ────────────────────────────────────────────────────
  async delete(table, id) {
    if (window.ADMIN_API) {
      const res = await window.adminFetch(`/api/admin?table=${encodeURIComponent(table)}&action=delete&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`[Admin delete:${table}] ${await res.text()}`);
      return true;
    }
    const res = await fetch(`${this.url}/rest/v1/${table}?id=eq.${id}`, {
      method: 'DELETE',
      headers: this.headers
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`[Supabase delete:${table}] ${err}`);
    }
    return true;
  },

  // ── STORAGE UPLOAD ────────────────────────────────────────────
  async upload(file, bucket = 'public-assets') {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    const maxSize = 5 * 1024 * 1024;
    if (!file || !allowed.includes(file.type)) throw new Error('نوع الصورة غير مسموح؛ استخدم PNG أو JPEG أو WebP');
    if (file.size > maxSize) throw new Error('حجم الصورة أكبر من 5 ميجابايت');

    if (window.ADMIN_API) {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
        reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
        reader.readAsDataURL(file);
      });
      const res = await window.adminFetch(`/api/admin-upload?bucket=${encodeURIComponent(bucket)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mimeType: file.type, originalName: file.name, contentBase64: dataUrl })
      });
      if (!res.ok) throw new Error(`[Admin upload:${bucket}] ${await res.text()}`);
      const data = await res.json();
      if (!data.url) throw new Error('لم يرجع الخادم رابط الصورة');
      return data.url;
    }

    const ext  = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1];
    const safe = Math.random().toString(36).substring(2, 8);
    const fileName = `${Date.now()}_${safe}.${ext}`;
    const res = await fetch(`${this.url}/storage/v1/object/${bucket}/${fileName}`, {
      method: 'POST',
      headers: { 'Authorization': this.headers.Authorization, 'apikey': this.key, 'Content-Type': file.type, 'x-upsert': 'true' },
      body: file
    });
    if (!res.ok) throw new Error(`[Supabase upload:${bucket}/${fileName}] ${await res.text()}`);
    return `${this.url}/storage/v1/object/public/${bucket}/${fileName}`;
  },

  async replaceProductCategories(productId, categoryIds) {
    if (!window.ADMIN_API) throw new Error('ربط الأقسام متاح من لوحة الإدارة فقط');
    const res = await window.adminFetch(`/api/admin?table=product_categories&action=replace_product_categories&id=${encodeURIComponent(productId)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category_ids: categoryIds })
    });
    if (!res.ok) throw new Error(`[Admin product_categories] ${await res.text()}`);
    return true;
  }
};
