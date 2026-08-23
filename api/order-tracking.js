const { selectRows, insertRows } = require('./_supabase');

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').replace(/^20/, '0');
}

function pick(value, keys) {
  for (const key of keys) {
    if (value && value[key] !== undefined && value[key] !== null && value[key] !== '') {
      return value[key];
    }
  }
  return null;
}

async function findOrder({ phone, orderNumber, trackingNumber }) {
  const queries = [];
  if (phone) queries.push(`phone=eq.${phone}`);
  if (orderNumber) queries.push(`order_number=eq.${orderNumber}`);
  if (trackingNumber) queries.push(`bosta_tracking_number=eq.${trackingNumber}`);

  for (const query of queries) {
    const rows = await selectRows('orders', { select: '*', filters: [query], useServiceRole: true });
    if (rows && rows.length) return rows[0];
  }

  return null;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 200, {
      ok: true,
      endpoint: '/api/order-tracking',
      message: 'POST a phone number or order reference to retrieve tracking info'
    });
    return;
  }

  try {
    const payload = req.body || {};
    const phone = normalizePhone(pick(payload, ['phone', 'mobile', 'customerPhone']) || '');
    const orderNumber = String(pick(payload, ['orderNumber', 'order_number', 'orderId', 'reference']) || '').trim();
    const trackingNumber = String(pick(payload, ['trackingNumber', 'tracking_number', 'bostaTrackingNumber']) || '').trim();

    const order = await findOrder({ phone, orderNumber, trackingNumber });
    const eventRow = {
      lookup_phone: phone || null,
      lookup_order_number: orderNumber || null,
      lookup_tracking_number: trackingNumber || null,
      matched_order_id: order?.id || null,
      matched_customer_name: order?.customer_name || null,
      matched_phone: order?.phone || null,
      matched_status: order?.status || 'not_found',
      created_at: new Date().toISOString()
    };

    try {
      await insertRows('tracking_events', eventRow, { useServiceRole: true });
    } catch (logError) {
      console.warn('tracking event log skipped', logError.message);
    }

    if (!order) {
      return sendJson(res, 200, {
        ok: true,
        found: false,
        message: 'لم يتم العثور على الطلب',
        tracking: null
      });
    }

    return sendJson(res, 200, {
      ok: true,
      found: true,
      tracking: {
        id: order.id,
        order_number: order.order_number || order.id || null,
        customer_name: order.customer_name || '',
        phone: order.phone || '',
        governorate: order.governorate || '',
        address: order.address || '',
        status: order.status || 'pending',
        shipping_fee: order.shipping_fee || 0,
        total_amount: order.total_amount || 0,
        bosta_tracking_number: order.bosta_tracking_number || null,
        created_at: order.created_at || null,
        updated_at: order.updated_at || null
      }
    });
  } catch (error) {
    console.error('Order tracking lookup failed:', error);
    return sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
};

