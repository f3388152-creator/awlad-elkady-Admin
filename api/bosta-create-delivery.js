const { cors, json, parseBody, supabase, createBostaDelivery } = require('./_server');

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const body = parseBody(req);
  const orderId = Number(body.order_id);
  const accessToken = String(body.access_token || '');
  if (!Number.isInteger(orderId) || !accessToken || accessToken.length < 16) {
    return json(res, 400, { error: 'Invalid order confirmation' });
  }

  try {
    const rows = await supabase(`/rest/v1/orders?id=eq.${orderId}&customer_access_token=eq.${encodeURIComponent(accessToken)}&select=*`);
    const order = rows?.[0];
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
    if (error.message === 'BOSTA_SERVER_ENV_MISSING') return json(res, 503, { error: 'Bosta integration is not configured' });
    return json(res, error.status || 502, { error: 'Bosta delivery creation failed' });
  }
};
