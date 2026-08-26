const { cors, json, parseBody, supabase, webhookAuthorized } = require('../lib/_server');

const STATUS_MAP = {
  10: 'جديد',
  11: 'قيد التجهيز',
  20: 'قيد التجهيز',
  21: 'تم الشحن',
  22: 'تم الشحن',
  23: 'مرتجع',
  24: 'تم الشحن',
  30: 'تم الشحن',
  40: 'تم الشحن',
  41: 'تم الشحن',
  45: 'تم التسليم',
  46: 'مرتجع',
  47: 'مشكلة في التوصيل',
  48: 'ملغى',
  49: 'ملغى',
  60: 'مرتجع',
  100: 'مفقود',
  101: 'تالف',
  102: 'قيد المراجعة',
  103: 'يحتاج إجراء',
  104: 'مؤرشف',
  105: 'معلق'
};

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!webhookAuthorized(req)) return json(res, 401, { error: 'Webhook authorization required' });

  const event = parseBody(req);
  const tracking = event.trackingNumber == null ? '' : String(event.trackingNumber);
  const deliveryId = event._id == null ? '' : String(event._id);
  const businessReference = event.businessReference == null ? '' : String(event.businessReference);
  if (!tracking && !deliveryId && !businessReference) return json(res, 400, { error: 'Missing shipment identifier' });

  try {
    const filters = [];
    if (deliveryId) filters.push(`bosta_delivery_id=eq.${encodeURIComponent(deliveryId)}`);
    if (tracking) filters.push(`bosta_tracking_number=eq.${encodeURIComponent(tracking)}`);
    if (businessReference) filters.push(`bosta_business_reference=eq.${encodeURIComponent(businessReference)}`);

    let order = null;
    for (const filter of filters) {
      const rows = await supabase(`/rest/v1/orders?${filter}&select=id,status`);
      if (rows?.[0]) { order = rows[0]; break; }
    }
    if (!order) return json(res, 404, { error: 'Shipment order not found' });

    const stateValue = event.state && typeof event.state === 'object' ? event.state.code : event.state;
    const state = Number(stateValue);
    const patch = {
      bosta_status: Number.isFinite(state) ? String(state) : (stateValue || null),
      bosta_tracking_number: tracking || undefined,
      bosta_delivery_id: deliveryId || undefined,
      bosta_business_reference: businessReference || undefined,
      bosta_last_event: event,
      bosta_webhook_at: new Date().toISOString(),
      status: STATUS_MAP[state] || order.status || 'قيد التجهيز'
    };
    await supabase(`/rest/v1/orders?id=eq.${order.id}`, 'PATCH', patch, 'return=minimal');
    return json(res, 200, { ok: true });
  } catch (error) {
    console.error('[bosta-webhook]', error.message, error.data || '');
    return json(res, error.status || 500, { error: 'Webhook processing failed' });
  }
};
