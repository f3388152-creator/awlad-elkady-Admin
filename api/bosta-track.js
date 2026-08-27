const { cors, json, parseBody, supabase } = require('../lib/_server');

const TERMINAL_STATUSES = new Set(['تم التسليم', 'مرفوض', 'ملغي', 'مرتجع', 'تم الإلغاء']);
const EDITABLE_FIELDS = new Set(['customer_name', 'customer_phone', 'governorate', 'area', 'address', 'notes']);

function normalizeDigits(value) {
  return String(value || '').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}

function normalizePhone(value) {
  return normalizeDigits(value).replace(/[\s()-]/g, '').trim();
}

function getPolicy(order) {
  const status = String(order.status || 'جديد');
  const hasBostaShipment = Boolean(order.bosta_tracking_number || order.bosta_delivery_id);
  const terminal = TERMINAL_STATUSES.has(status);
  return {
    can_request_cancel: !terminal,
    can_request_edit: !terminal && ['جديد', 'قيد التجهيز'].includes(status) && !hasBostaShipment,
    has_bosta_shipment: hasBostaShipment,
    message: terminal
      ? 'الطلب وصل لحالة نهائية ولا توجد إجراءات ذاتية متاحة.'
      : hasBostaShipment
        ? 'الشحنة موجودة في Bosta؛ تعديل البيانات غير متاح ذاتياً، وطلب الإلغاء يحتاج مراجعة الإدارة وبوسطة.'
        : 'يمكنك إرسال طلب إلغاء أو طلب تعديل بيانات التوصيل، والإدارة تراجعه قبل التنفيذ.'
  };
}

function safeItems(items) {
  return (Array.isArray(items) ? items : []).slice(0, 100).map(item => ({
    name: String(item?.name || 'منتج').slice(0, 200),
    qty: Math.max(1, Math.min(999, Number(item?.qty) || 1)),
    price: Number(item?.price) || 0,
    image: typeof item?.image === 'string' ? item.image.slice(0, 1000) : null
  }));
}

function safeOrder(order, requests = []) {
  return {
    id: order.id,
    created_at: order.created_at,
    status: order.status || 'جديد',
    customer_name: String(order.customer_name || '').slice(0, 120),
    customer_phone: String(order.customer_phone || '').slice(0, 30),
    governorate: String(order.governorate || '').slice(0, 120),
    area: String(order.area || '').slice(0, 120),
    address: String(order.address || '').slice(0, 300),
    notes: String(order.notes || '').slice(0, 500),
    subtotal: Number(order.subtotal || 0),
    shipping_fee: Number(order.shipping_fee || 0),
    total: Number(order.total || 0),
    items: safeItems(order.items),
    bosta_status: order.bosta_status || null,
    bosta_tracking_number: order.bosta_tracking_number || null,
    policy: getPolicy(order),
    customer_requests: requests.map(request => ({
      id: request.id,
      request_type: request.request_type,
      status: request.status,
      created_at: request.created_at
    }))
  };
}

async function findManagedOrder(orderId, accessToken) {
  if (!Number.isInteger(orderId) || orderId <= 0 || accessToken.length < 16 || accessToken.length > 200) return null;
  const rows = await supabase(`/rest/v1/orders?id=eq.${orderId}&customer_access_token=eq.${encodeURIComponent(accessToken)}&select=id,created_at,status,customer_name,customer_phone,governorate,area,address,subtotal,shipping_fee,total,items,bosta_status,bosta_tracking_number,bosta_delivery_id&limit=1`);
  return rows?.[0] || null;
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const orderId = Number(req.query?.order_id);
    const accessToken = String(req.query?.access_token || '').trim();

    if (Number.isInteger(orderId) && accessToken) {
      try {
        const order = await findManagedOrder(orderId, accessToken);
        if (!order) return json(res, 404, { error: 'Order not found' });
        const requests = await supabase(`/rest/v1/order_customer_requests?order_id=eq.${order.id}&select=id,request_type,status,created_at&order=created_at.desc&limit=20`);
        return json(res, 200, safeOrder(order, requests || []));
      } catch (error) {
        console.error('[bosta-track managed]', error.message, error.data || '');
        return json(res, error.status || 500, { error: 'Tracking unavailable' });
      }
    }

    const phone = normalizePhone(req.query?.phone);
    if (!/^01[0125][0-9]{8}$/.test(phone)) return json(res, 400, { error: 'Invalid phone' });

    try {
      const rows = await supabase(`/rest/v1/orders?customer_phone=eq.${encodeURIComponent(phone)}&select=id,created_at,status,bosta_tracking_number,total&order=created_at.desc&limit=5`);
      return json(res, 200, (rows || []).map(order => ({
        id: order.id,
        created_at: order.created_at,
        status: order.status || 'جديد',
        bosta_tracking_number: order.bosta_tracking_number || null,
        total: Number(order.total || 0)
      })));
    } catch (error) {
      console.error('[bosta-track]', error.message, error.data || '');
      return json(res, error.status || 500, { error: 'Tracking unavailable' });
    }
  }

  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const body = parseBody(req);
  const orderId = Number(body.order_id);
  const accessToken = String(body.access_token || '').trim();
  const requestType = String(body.request_type || '').trim().toLowerCase();
  const reason = String(body.reason || '').trim();
  const requestedChanges = body.requested_changes && typeof body.requested_changes === 'object' && !Array.isArray(body.requested_changes)
    ? body.requested_changes
    : {};

  if (!Number.isInteger(orderId) || orderId <= 0 || accessToken.length < 16 || accessToken.length > 200) return json(res, 400, { error: 'بيانات إدارة الطلب غير صحيحة.' });
  if (!['cancel', 'edit'].includes(requestType)) return json(res, 400, { error: 'نوع الطلب غير مسموح.' });
  if (reason.length < 5 || reason.length > 1000) return json(res, 422, { error: 'السبب إجباري ويجب أن يكون بين 5 و1000 حرف.' });

  try {
    const order = await findManagedOrder(orderId, accessToken);
    if (!order) return json(res, 404, { error: 'Order not found' });
    const policy = getPolicy(order);
    if (requestType === 'cancel' && !policy.can_request_cancel) return json(res, 409, { error: policy.message });
    if (requestType === 'edit' && !policy.can_request_edit) return json(res, 409, { error: policy.message });

    const pending = await supabase(`/rest/v1/order_customer_requests?order_id=eq.${order.id}&request_type=eq.${requestType}&status=eq.pending&select=id&limit=1`);
    if (pending?.length) return json(res, 409, { error: 'يوجد طلب مماثل قيد المراجعة بالفعل.' });

    let changes = {};
    if (requestType === 'edit') {
      const unknown = Object.keys(requestedChanges).some(key => !EDITABLE_FIELDS.has(key));
      if (unknown) return json(res, 422, { error: 'التعديل مسموح لبيانات التوصيل فقط.' });
      for (const key of EDITABLE_FIELDS) {
        if (requestedChanges[key] !== undefined && requestedChanges[key] !== null) changes[key] = String(requestedChanges[key]).trim();
      }
      if (changes.customer_phone !== undefined) changes.customer_phone = normalizePhone(changes.customer_phone);
      if (changes.customer_name !== undefined && (changes.customer_name.length < 2 || changes.customer_name.length > 120)) return json(res, 422, { error: 'الاسم غير صحيح.' });
      if (changes.customer_phone !== undefined && !/^01[0125][0-9]{8}$/.test(changes.customer_phone)) return json(res, 422, { error: 'رقم الموبايل غير صحيح.' });
      if (changes.governorate !== undefined && !changes.governorate) return json(res, 422, { error: 'المحافظة مطلوبة.' });
      if (changes.area !== undefined && !changes.area) return json(res, 422, { error: 'المنطقة مطلوبة.' });
      if (changes.address !== undefined && (changes.address.length < 5 || changes.address.length > 300)) return json(res, 422, { error: 'العنوان غير صحيح.' });
      if (changes.notes !== undefined && changes.notes.length > 500) return json(res, 422, { error: 'الملاحظات طويلة جداً.' });
      if (!Object.keys(changes).length) return json(res, 422, { error: 'اكتب بياناً واحداً على الأقل تريد تعديله.' });
    }

    const created = await supabase('/rest/v1/order_customer_requests', 'POST', {
      order_id: order.id,
      request_type: requestType,
      reason,
      requested_changes: changes
    }, 'return=representation');
    const request = Array.isArray(created) ? created[0] : created;
    return json(res, 201, { ok: true, request_id: request?.id || null, status: 'pending', message: 'تم إرسال طلبك للإدارة للمراجعة.' });
  } catch (error) {
    console.error('[bosta-track request]', error.message, error.data || '');
    return json(res, error.status || 500, { error: 'تعذر تسجيل طلبك حالياً.' });
  }
};
