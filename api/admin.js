const { token, authorize, SERVICE_ROLE_KEY, SUPABASE_URL } = require('../lib/admin-session');

const ALLOWED_TABLES = new Set([
  'products', 'categories', 'product_categories', 'orders', 'complaints',
  'order_customer_requests', 'site_settings', 'faqs', 'socials', 'shipping_rates'
]);
const ALLOWED_RPCS = new Set(['create_order_with_stock', 'create_order_with_stock_bulk', 'decrement_product_stock']);

const READ_PERMISSIONS = {
  products: 'products.view', categories: 'categories.view', product_categories: 'categories.view',
  orders: 'orders.view', complaints: 'complaints.view', order_customer_requests: 'orders.view',
  site_settings: 'landing.view', faqs: 'landing.view', socials: 'landing.view', shipping_rates: 'landing.view'
};
const WRITE_PERMISSIONS = {
  products: { insert: 'products.create', insertReturn: 'products.create', update: 'products.update', delete: 'products.delete' },
  categories: { insert: 'categories.create', insertReturn: 'categories.create', update: 'categories.update', delete: 'categories.delete' },
  product_categories: { insert: 'categories.assign', insertReturn: 'categories.assign', update: 'categories.assign', delete: 'categories.assign' },
  orders: { update: 'orders.update_status', delete: 'orders.archive' },
  order_customer_requests: { update: 'orders.update_status' },
  complaints: { update: 'complaints.update_status', delete: 'complaints.delete' },
  site_settings: { update: 'landing.edit' }, faqs: { insert: 'landing.edit_faq', insertReturn: 'landing.edit_faq', update: 'landing.edit_faq', delete: 'landing.edit_faq' },
  socials: { insert: 'landing.edit_contact', insertReturn: 'landing.edit_contact', update: 'landing.edit_contact', delete: 'landing.edit_contact' },
  shipping_rates: { insert: 'landing.edit_shipping', insertReturn: 'landing.edit_shipping', update: 'landing.edit_shipping', delete: 'landing.edit_shipping' }
};

function sendError(res, status, error) { return res.status(status).json({ error }); }

function orderUpdatePermission(body) {
  const keys = Object.keys(body && typeof body === 'object' ? body : {});
  const statusFields = new Set(['status']);
  const customerFields = new Set(['customer_name', 'customer_phone', 'customer_second_phone', 'governorate', 'area', 'address', 'notes']);
  const unknownField = keys.some(key => !statusFields.has(key) && !customerFields.has(key));
  if (unknownField || !keys.length) return ['orders.update_status', 'orders.update_customer'];
  const required = [];
  if (keys.some(key => statusFields.has(key))) required.push('orders.update_status');
  if (keys.some(key => customerFields.has(key))) required.push('orders.update_customer');
  return required;
}

function siteSettingsPermission(body) {
  const keys = Object.keys(body && typeof body === 'object' ? body : {});
  if (!keys.length) return 'landing.edit';
  const groups = [
    [['logo_header', 'logo_footer', 'site_name', 'brand_name', 'seo_description', 'page_title'], 'landing.edit_identity'],
    [['marquee_text', 'marquee_behavior', 'marquee_end_date', 'hero_title', 'hero_subtitle', 'hero_tagline', 'catalog_title', 'catalog_subtitle', 'trust_cards', 'section_visibility', 'testimonials'], 'landing.edit_content'],
    [['address', 'footer_phone', 'whatsapp_number'], 'landing.edit_contact'],
    [['shipping_custom', 'shipping_type', 'shipping_flat_rate', 'free_shipping_enabled', 'free_shipping_threshold'], 'landing.edit_shipping'],
    [['bosta_default_package_type'], 'landing.edit_bosta'],
    [['maintenance_mode', 'maintenance_message'], 'landing.edit_maintenance']
  ];
  const required = new Set();
  for (const key of keys) {
    const group = groups.find(([fields]) => fields.includes(key));
    if (!group) return 'landing.edit';
    required.add(group[1]);
  }
  return [...required];
}

async function upstream(path, method, req, body, prefer = 'return=minimal') {
  const key = SERVICE_ROLE_KEY || token(req);
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': req.headers['content-type'] || 'application/json',
    Prefer: prefer
  };
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
  });
  const text = await response.text();
  return { response, text };
}

module.exports = async (req, res) => {
  const params = req.query || {};
  const table = typeof params.table === 'string' ? params.table : '';
  const action = typeof params.action === 'string' ? params.action : 'select';
  const id = params.id;
  const fn = params.fn;

  if (action === 'rpc') {
    if (!ALLOWED_RPCS.has(fn)) return sendError(res, 400, 'Unsupported RPC');
    const auth = await authorize(req, 'orders.create');
    if (!auth.ok) return sendError(res, auth.status, auth.status === 401 ? 'Admin session required' : 'Permission denied');
    const result = await upstream(`/rest/v1/rpc/${fn}`, 'POST', req, req.body || {}, 'return=representation');
    res.status(result.response.status);
    return result.text ? res.send(result.text) : res.end();
  }

  if (action === 'review_customer_request') {
    const auth = await authorize(req, 'orders.update_status');
    if (!auth.ok) return sendError(res, auth.status, auth.status === 401 ? 'Admin session required' : 'Permission denied');

    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const requestId = Number(body.request_id);
    const decision = String(body.decision || '').trim().toLowerCase();
    const adminNote = String(body.admin_note || '').trim().slice(0, 500);
    if (!Number.isInteger(requestId) || requestId <= 0 || !['approve', 'reject'].includes(decision)) {
      return sendError(res, 400, 'Invalid customer request review');
    }

    try {
      const requestResult = await upstream(`/rest/v1/order_customer_requests?id=eq.${requestId}&select=*`, 'GET', req, undefined, '');
      if (!requestResult.response.ok) { res.status(requestResult.response.status); return requestResult.text ? res.send(requestResult.text) : res.end(); }
      const requestRows = JSON.parse(requestResult.text || '[]');
      const customerRequest = requestRows?.[0];
      if (!customerRequest) return sendError(res, 404, 'Customer request not found');
      if (customerRequest.status !== 'pending') return sendError(res, 409, 'Customer request already reviewed');

      const orderResult = await upstream(`/rest/v1/orders?id=eq.${encodeURIComponent(String(customerRequest.order_id))}&select=id,status,bosta_tracking_number,bosta_delivery_id`, 'GET', req, undefined, '');
      if (!orderResult.response.ok) { res.status(orderResult.response.status); return orderResult.text ? res.send(orderResult.text) : res.end(); }
      const order = JSON.parse(orderResult.text || '[]')?.[0];
      if (!order) return sendError(res, 404, 'Order not found');

      if (decision === 'reject') {
        const rejected = await upstream(`/rest/v1/order_customer_requests?id=eq.${requestId}`, 'PATCH', req, {
          status: 'rejected', admin_note: adminNote || 'تم رفض الطلب بعد المراجعة.', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
        });
        if (!rejected.response.ok) { res.status(rejected.response.status); return rejected.text ? res.send(rejected.text) : res.end(); }
        return res.status(200).json({ ok: true, status: 'rejected' });
      }

      if (!['جديد', 'قيد التجهيز'].includes(String(order.status || 'جديد'))) {
        return sendError(res, 409, 'لا يمكن تنفيذ الطلب بعد تغير حالة الشحنة.');
      }
      if (order.bosta_tracking_number || order.bosta_delivery_id) {
        return sendError(res, 409, 'الشحنة موجودة في Bosta؛ يلزم مراجعتها من Bosta قبل تنفيذ التغيير.');
      }

      if (customerRequest.request_type === 'cancel') {
        const cancelled = await upstream(`/rest/v1/orders?id=eq.${encodeURIComponent(String(order.id))}`, 'PATCH', req, { status: 'ملغي' });
        if (!cancelled.response.ok) { res.status(cancelled.response.status); return cancelled.text ? res.send(cancelled.text) : res.end(); }
      } else if (customerRequest.request_type === 'edit') {
        const changes = customerRequest.requested_changes && typeof customerRequest.requested_changes === 'object' ? customerRequest.requested_changes : {};
        const allowedFields = new Set(['customer_name', 'customer_phone', 'governorate', 'area', 'address', 'notes']);
        const unknown = Object.keys(changes).some(key => !allowedFields.has(key));
        if (unknown) return sendError(res, 400, 'بيانات التعديل غير مسموحة');
        const patch = {};
        for (const key of allowedFields) if (changes[key] !== undefined && changes[key] !== null) patch[key] = String(changes[key]).trim();
        if (patch.customer_name !== undefined && (patch.customer_name.length < 2 || patch.customer_name.length > 120)) return sendError(res, 400, 'الاسم غير صحيح');
        if (patch.customer_phone !== undefined && !/^01[0125][0-9]{8}$/.test(patch.customer_phone)) return sendError(res, 400, 'رقم الموبايل غير صحيح');
        if (patch.governorate !== undefined && !patch.governorate) return sendError(res, 400, 'المحافظة مطلوبة');
        if (patch.area !== undefined && !patch.area) return sendError(res, 400, 'المنطقة مطلوبة');
        if (patch.address !== undefined && (patch.address.length < 5 || patch.address.length > 300)) return sendError(res, 400, 'العنوان غير صحيح');
        if (patch.notes !== undefined && patch.notes.length > 500) return sendError(res, 400, 'الملاحظات طويلة جداً');
        if (!Object.keys(patch).length) return sendError(res, 400, 'لا توجد بيانات تعديل صالحة');
        const updated = await upstream(`/rest/v1/orders?id=eq.${encodeURIComponent(String(order.id))}`, 'PATCH', req, patch);
        if (!updated.response.ok) { res.status(updated.response.status); return updated.text ? res.send(updated.text) : res.end(); }
      } else {
        return sendError(res, 400, 'نوع طلب غير مسموح');
      }

      const applied = await upstream(`/rest/v1/order_customer_requests?id=eq.${requestId}`, 'PATCH', req, {
        status: 'applied', admin_note: adminNote || 'تم التنفيذ من لوحة الإدارة.', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      });
      if (!applied.response.ok) { res.status(applied.response.status); return applied.text ? res.send(applied.text) : res.end(); }
      return res.status(200).json({ ok: true, status: 'applied' });
    } catch (error) {
      console.error('[review-customer-request]', error.message);
      return sendError(res, 500, 'تعذر مراجعة طلب العميل');
    }
  }

  if (!ALLOWED_TABLES.has(table)) return sendError(res, 400, 'Unsupported resource');

  if (action === 'replace_product_categories') {
    const auth = await authorize(req, 'categories.assign');
    if (!auth.ok) return sendError(res, auth.status, auth.status === 401 ? 'Admin session required' : 'Permission denied');
    const productId = Number(id);
    const categoryIds = Array.isArray(req.body?.category_ids) ? req.body.category_ids.map(Number).filter(Number.isInteger) : [];
    if (!Number.isInteger(productId) || categoryIds.some(value => value <= 0)) return sendError(res, 400, 'Invalid product categories');
    const removed = await upstream(`/rest/v1/product_categories?product_id=eq.${productId}`, 'DELETE', req, undefined);
    if (!removed.response.ok) { res.status(removed.response.status); return removed.text ? res.send(removed.text) : res.end(); }
    if (categoryIds.length) {
      const inserted = await upstream('/rest/v1/product_categories', 'POST', req, categoryIds.map(category_id => ({ product_id: productId, category_id })), 'return=minimal');
      if (!inserted.response.ok) { res.status(inserted.response.status); return inserted.text ? res.send(inserted.text) : res.end(); }
    }
    return res.status(204).end();
  }

  const permission = action === 'select'
    ? READ_PERMISSIONS[table]
    : (table === 'orders' && action === 'update'
      ? orderUpdatePermission(req.body)
      : (table === 'site_settings' && action === 'update' ? siteSettingsPermission(req.body) : WRITE_PERMISSIONS[table]?.[action]));
  if (!permission) return sendError(res, 400, 'Unsupported action');
  const auth = await authorize(req, permission);
  if (!auth.ok) return sendError(res, auth.status, auth.status === 401 ? 'Admin session required' : 'Permission denied');

  if (action === 'select') {
    const query = typeof params.query === 'string' ? params.query : '';
    const path = `/rest/v1/${table}?select=*${query ? `&${query}` : ''}`;
    const result = await upstream(path, 'GET', req, undefined, '');
    res.status(result.response.status);
    return result.text ? res.send(result.text) : res.end();
  }

  if (['update', 'delete'].includes(action) && (id === undefined || id === '')) return sendError(res, 400, 'Missing id');
  const encodedId = encodeURIComponent(String(id));
  const path = action === 'insert' || action === 'insertReturn' ? `/rest/v1/${table}` : `/rest/v1/${table}?id=eq.${encodedId}`;
  const method = action === 'delete' ? 'DELETE' : action === 'update' ? 'PATCH' : 'POST';
  const prefer = action === 'insert' || action === 'insertReturn' ? 'return=representation' : 'return=minimal';
  const result = await upstream(path, method, req, method === 'DELETE' ? undefined : (req.body || {}), prefer);
  res.status(result.response.status);
  return result.text ? res.send(result.text) : res.end();
};
