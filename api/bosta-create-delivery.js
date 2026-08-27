const { cors, json, parseBody, supabase, createBostaDelivery, BOSTA_API_KEY, BOSTA_BASE_URL } = require('../lib/_server');
const { authorize } = require('../lib/admin-session');

async function getOrder(orderId) {
  const rows = await supabase(`/rest/v1/orders?id=eq.${encodeURIComponent(String(orderId))}&select=*`);
  return rows?.[0] || null;
}

async function markPacked(req, res, body) {
  const auth = await authorize(req, 'bosta.pack');
  if (!auth.ok) return json(res, auth.status, auth.status === 401 ? 'Admin session required' : 'Permission denied');
  const orderId = Number(body.order_id);
  if (!Number.isInteger(orderId) || orderId <= 0) return json(res, 400, { error: 'رقم الطلب غير صحيح.' });
  try {
    const order = await getOrder(orderId);
    if (!order) return json(res, 404, { error: 'الطلب غير موجود.' });
    if (!order.bosta_tracking_number && !order.bosta_delivery_id) return json(res, 409, { error: 'لا يمكن تأكيد التغليف قبل إنشاء شحنة Bosta وبوليصة لها.' });
    if (['تم التسليم', 'ملغي', 'مرفوض', 'مرتجع'].includes(String(order.status || ''))) return json(res, 409, { error: 'حالة الطلب لا تسمح بتأكيد التغليف.' });
    await supabase(`/rest/v1/orders?id=eq.${order.id}`, 'PATCH', {
      status: 'قيد التجهيز',
      bosta_status: 'packed',
      bosta_last_event: { source: 'admin', event: 'packed', at: new Date().toISOString(), actor: auth.user?.email || 'admin' }
    }, 'return=minimal');
    return json(res, 200, { ok: true, status: 'قيد التجهيز' });
  } catch (error) {
    console.error('[bosta-pack]', error.message, error.data || '');
    return json(res, error.status || 500, { error: 'تعذر حفظ حالة التغليف.' });
  }
}

async function printAwb(req, res, body) {
  const auth = await authorize(req, 'bosta.print_awb');
  if (!auth.ok) return json(res, auth.status, auth.status === 401 ? 'Admin session required' : 'Permission denied');
  const orderId = Number(body.order_id);
  const awbType = body.awb_type === 'A6' ? 'A6' : 'A4';
  if (!Number.isInteger(orderId) || orderId <= 0) return json(res, 400, { error: 'رقم الطلب غير صحيح.' });
  if (!BOSTA_API_KEY) return json(res, 503, { error: 'Bosta integration is not configured' });
  try {
    const order = await getOrder(orderId);
    if (!order) return json(res, 404, { error: 'الطلب غير موجود.' });
    const identifier = order.bosta_tracking_number || order.bosta_delivery_id;
    if (!identifier) return json(res, 409, { error: 'لا توجد شحنة Bosta مرتبطة بالطلب.' });
    const payload = order.bosta_tracking_number
      ? { trackingNumbers: String(order.bosta_tracking_number), requestedAwbType: awbType, lang: 'ar' }
      : { ids: String(order.bosta_delivery_id), requestedAwbType: awbType, lang: 'ar' };
    const response = await fetch(`${BOSTA_BASE_URL}/deliveries/mass-awb`, {
      method: 'POST',
      headers: { Authorization: BOSTA_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!response.ok) {
      const text = await response.text();
      console.error('[bosta-awb]', response.status, text.slice(0, 500));
      return json(res, response.status || 502, { error: 'Bosta رفضت طباعة البوليصة.' });
    }
    if (contentType.includes('application/pdf') || contentType.includes('octet-stream')) {
      const pdfBase64 = Buffer.from(await response.arrayBuffer()).toString('base64');
      return json(res, 200, { ok: true, format: 'pdf', filename: `bosta-awb-${order.id}.pdf`, pdf_base64: pdfBase64 });
    }
    const data = await response.json().catch(() => ({}));
    const pdfBase64 = data?.data?.pdf || data?.pdf || data?.data || null;
    return json(res, 200, { ok: true, format: pdfBase64 ? 'pdf_base64' : 'queued', filename: `bosta-awb-${order.id}.pdf`, pdf_base64: typeof pdfBase64 === 'string' ? pdfBase64 : null, message: pdfBase64 ? 'تم تجهيز البوليصة.' : 'تم إرسال طلب الطباعة إلى Bosta.' });
  } catch (error) {
    console.error('[bosta-awb]', error.message, error.data || '');
    return json(res, 502, { error: 'تعذر الاتصال بخدمة طباعة Bosta.' });
  }
}

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const body = parseBody(req);

  if (body.action === 'mark_packed') return markPacked(req, res, body);
  if (body.action === 'print_awb') return printAwb(req, res, body);

  const orderId = Number(body.order_id);
  const accessToken = String(body.access_token || '');
  if (!Number.isInteger(orderId) || !accessToken || accessToken.length < 16) {
    return json(res, 400, { error: 'Invalid order confirmation' });
  }

  let order = null;
  try {
    const rows = await supabase(`/rest/v1/orders?id=eq.${orderId}&customer_access_token=eq.${encodeURIComponent(accessToken)}&select=*`);
    order = rows?.[0] || null;
    if (!order) return json(res, 404, { error: 'Order not found' });
    if (order.bosta_tracking_number || order.bosta_delivery_id) {
      return json(res, 200, { ok: true, already_created: true, tracking_number: order.bosta_tracking_number || null });
    }
    if (String(order.payment_method || 'cod') !== 'cod') return json(res, 409, { error: 'Unsupported payment method' });

    const settings = await supabase('/rest/v1/site_settings?select=bosta_default_package_type&limit=1');
    const packageType = settings?.[0]?.bosta_default_package_type || process.env.BOSTA_DEFAULT_PACKAGE_TYPE || 'SMALL';
    const result = await createBostaDelivery(order, packageType);
    const source = result?.data || result?.delivery || result || {};
    const trackingNumber = source.trackingNumber || source.tracking_number || result?.trackingNumber || null;
    const deliveryId = source._id || source.id || result?.deliveryId || null;
    if (!trackingNumber && !deliveryId) {
      const error = new Error('BOSTA_RESPONSE_MISSING_IDENTIFIERS');
      error.status = 502;
      error.data = { response_keys: Object.keys(source || {}).slice(0, 20) };
      throw error;
    }
    const businessReference = source.businessReference || `AWK-${order.id}`;
    await supabase(`/rest/v1/orders?id=eq.${order.id}`, 'PATCH', {
      bosta_status: 'created',
      bosta_delivery_id: deliveryId ? String(deliveryId) : null,
      bosta_tracking_number: trackingNumber ? String(trackingNumber) : null,
      bosta_business_reference: businessReference,
      bosta_created_at: new Date().toISOString()
    }, 'return=minimal');
    return json(res, 200, { ok: true, tracking_number: trackingNumber, delivery_id: deliveryId });
  } catch (error) {
    console.error('[bosta-create-delivery]', error.message, error.data || '');
    if (order?.id) {
      await supabase(`/rest/v1/orders?id=eq.${order.id}`, 'PATCH', {
        bosta_status: 'failed',
        bosta_last_event: { error: error.message, status: error.status || 502, at: new Date().toISOString() }
      }, 'return=minimal').catch(patchError => console.error('[bosta-create-delivery] status patch failed', patchError.message));
    }
    if (error.message === 'BOSTA_SERVER_ENV_MISSING') return json(res, 503, { error: 'Bosta integration is not configured' });
    if (error.message === 'BOSTA_ADDRESS_INCOMPLETE') return json(res, 422, { error: 'عنوان الشحن يحتاج المحافظة والمنطقة/الحي.' });
    if (error.message === 'BOSTA_CITY_NOT_FOUND') return json(res, 422, { error: 'المحافظة غير موجودة في تغطية Bosta.' });
    if (error.message === 'BOSTA_DISTRICT_NOT_FOUND') return json(res, 422, { error: 'المنطقة/الحي غير موجود في تغطية Bosta.' });
    return json(res, error.status || 502, { error: 'Bosta delivery creation failed' });
  }
};
