const { selectRows, updateRows } = require('./_supabase');

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
      return obj[key];
    }
  }
  return null;
}

function normalizeStatus(payload) {
  return String(
    pick(payload, ['status', 'state', 'event', 'shipmentStatus', 'bostaStatus']) || 'updated'
  ).toLowerCase();
}

async function findOrderByIdentifiers(identifiers) {
  const queries = [];
  if (identifiers.trackingNumber) {
    queries.push(`bosta_tracking_number=eq.${identifiers.trackingNumber}`);
  }
  if (identifiers.orderNumber) {
    queries.push(`order_number=eq.${identifiers.orderNumber}`);
  }

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
      status: 'online',
      endpoint: '/api/bosta-webhook',
      bostaApiKeyConfigured: Boolean(process.env.BOSTA_API_KEY)
    });
    return;
  }

  try {
    const payload = req.body || {};
    console.log('[BOSTA WEBHOOK EVENT RECEIVED]', JSON.stringify(payload, null, 2));

    const eventData = payload.data || payload.event || payload;
    const trackingNumber = pick(eventData, ['trackingNumber', 'tracking_number', 'waybill', 'awb', 'shipmentId']);
    const orderNumber = pick(eventData, ['orderNumber', 'order_number', 'reference', 'externalOrderId']);
    const status = normalizeStatus(eventData);

    const order = await findOrderByIdentifiers({ trackingNumber, orderNumber });
    if (!order) {
      return sendJson(res, 200, {
        ok: true,
        updated: false,
        message: 'Webhook received, but no matching order was found',
        received: { trackingNumber, orderNumber, status }
      });
    }

    const updatedRows = await updateRows(
      'orders',
      {
        status,
        bosta_tracking_number: trackingNumber || order.bosta_tracking_number || null
      },
      [`id=eq.${order.id}`],
      { useServiceRole: true }
    );

    return sendJson(res, 200, {
      ok: true,
      updated: true,
      orderId: order.id,
      status,
      updatedRows
    });
  } catch (error) {
    console.error('Error processing Bosta webhook:', error);
    return sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
};

