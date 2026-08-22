const { selectRows, insertRows } = require('./_supabase');

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function first(value) {
  if (Array.isArray(value)) return value[0];
  return value;
}

const WEIGHT_FIELD_MAP = {
  small_medium: 'size_small_medium',
  l: 'size_l',
  xl: 'size_xl',
  xxl: 'size_xxl',
  large: 'size_large',
  huge: 'size_huge'
};

const LEGACY_GOVERNORATE_FEES = {
  'القاهرة': 50,
  'الجيزة': 50,
  'الإسكندرية': 65,
  'القليوبية': 60,
  'الدقهلية': 65,
  'الغربية': 65,
  'الشرقية': 65,
  'المنوفية': 65,
  'البحيرة': 70,
  'كفر الشيخ': 70,
  'دمياط': 70,
  'بورسعيد': 75,
  'الإسماعيلية': 75,
  'السويس': 75,
  'الفيوم': 75,
  'بني سويف': 75,
  'المنيا': 85,
  'أسيوط': 85,
  'سوهاج': 90,
  'قنا': 95,
  'الأقصر': 100,
  'أسوان': 100
};

function normalizeWeight(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (['small', 'sm', 'small_medium', 'medium', 's/m', 'small-medium'].includes(raw)) return 'small_medium';
  if (raw === 'l') return 'l';
  if (raw === 'xl') return 'xl';
  if (raw === 'xxl') return 'xxl';
  if (['large', 'big', 'kebira', 'كبيرة'].includes(raw)) return 'large';
  if (['huge', 'massive', 'damha', 'ضخمة'].includes(raw)) return 'huge';
  return 'small_medium';
}

function parseGovernorates(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  const raw = String(value).trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((item) => String(item).trim()).filter(Boolean) : [raw];
  } catch {
    return raw.split(/[,،\n]/).map((item) => String(item).trim()).filter(Boolean);
  }
}

function getShippingFee(rate, weight) {
  const field = WEIGHT_FIELD_MAP[normalizeWeight(weight)];
  return Number(rate?.[field] || 0);
}

async function resolveShippingRate(governorate, shippingSize) {
  const rows = await selectRows('shipping_rates', { select: '*', useServiceRole: true });
  const normalizedGovernorate = String(governorate || '').trim().toLowerCase();
  const normalizedWeight = normalizeWeight(shippingSize);
  const matched = (rows || []).find((row) => {
    const governorates = parseGovernorates(row.governorates);
    return governorates.some((item) => item.toLowerCase() === normalizedGovernorate);
  }) || (rows || [])[0] || null;

  const fallbackFee = Number(LEGACY_GOVERNORATE_FEES[String(governorate || '').trim()] || 0);
  const fallbackMatched = fallbackFee > 0 ? { fallback: true } : null;
  const fee = matched ? getShippingFee(matched, normalizedWeight) : fallbackFee;

  return {
    row: matched || fallbackMatched,
    fee,
    weight: normalizedWeight
  };
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
      endpoint: '/api/bosta-create-label',
      message: 'POST order payload to create a Bosta label',
      bostaKeyConfigured: Boolean(process.env.BOSTA_API_KEY)
    });
    return;
  }

  try {
    const payload = req.body || {};
    const customer = payload.customer || {};
    const order = payload.order || {};
    const shippingSize = first(payload.shippingSize) || first(order.shippingSize) || first(order.packageSize);
    const rate = await resolveShippingRate(customer.governorate || payload.governorate || order.governorate, shippingSize);

    const lineTotal = Number(
      order.subtotal ??
      payload.subtotal ??
      (Number(order.unitPrice || 0) * Number(order.quantity || 1))
    );
    const shippingFee = Number(rate.fee || payload.shippingFee || 0);
    const codAmount = Number(payload.totalAmount ?? lineTotal + shippingFee);

    const bostaUrl = process.env.BOSTA_CREATE_LABEL_URL || 'https://api.bosta.co/api/v2/deliveries';
    const bostaApiKey = process.env.BOSTA_API_KEY || '';

    const bostaBody = {
      type: 'SEND',
      businessReference: payload.orderNumber || order.orderNumber || order.id || `AWLAD-${Date.now()}`,
      pickupAddress: {
        firstName: process.env.BOSTA_PICKUP_FIRST_NAME || 'أولاد القاضي',
        phone: process.env.BOSTA_PICKUP_PHONE || '',
        address: process.env.BOSTA_PICKUP_ADDRESS || '',
        city: process.env.BOSTA_PICKUP_CITY || 'القاهرة'
      },
      dropOffAddress: {
        firstName: customer.name || 'عميل',
        phone: customer.phone || '',
        secondPhone: customer.altPhone || '',
        address: customer.address || '',
        city: customer.governorate || payload.governorate || order.governorate || ''
      },
      receiver: {
        firstName: customer.name || 'عميل',
        phone: customer.phone || '',
        secondPhone: customer.altPhone || ''
      },
      cod: codAmount,
      notes: customer.notes || '',
      items: [{
        name: order.productTitle || 'طلب أولاد القاضي',
        quantity: Number(order.quantity || 1),
        price: lineTotal
      }]
    };

    let bostaResponse = null;
    if (!bostaApiKey) {
      return sendJson(res, 503, { ok: false, error: 'Bosta API key is not configured' });
    }
    if (bostaApiKey) {
      const response = await fetch(bostaUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': bostaApiKey,
          Authorization: `Bearer ${bostaApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(bostaBody)
      });

      const text = await response.text();
      try {
        bostaResponse = text ? JSON.parse(text) : null;
      } catch {
        bostaResponse = text;
      }

      if (!response.ok) {
        console.error('Bosta API error response:', { status: response.status, statusText: response.statusText, body: bostaResponse });
        return sendJson(res, response.status, {
          ok: false,
          error: 'Bosta API request failed',
          rate,
          bostaResponse
        });
      }
    }

    let insertedOrder = null;
    if (payload.persistOrder !== false) {
      const orderRow = {
        order_number: payload.orderNumber || order.orderNumber || order.id || `AWLAD-${Date.now()}`,
        customer_name: customer.name || order.customerName || '',
        phone: customer.phone || order.phone || '',
        governorate: customer.governorate || payload.governorate || order.governorate || '',
        address: customer.address || order.address || '',
        shipping_fee: shippingFee,
        total_amount: codAmount,
        status: bostaResponse?.status || 'label_created',
        bosta_tracking_number: bostaResponse?.trackingNumber || bostaResponse?.tracking_number || payload.trackingNumber || null,
        tracking_source: 'bosta_create_label'
      };

      try {
        const [row] = await insertRows('orders', orderRow, { useServiceRole: true });
        insertedOrder = row || null;
      } catch (insertError) {
        insertedOrder = { error: insertError.message };
      }
    }

    return sendJson(res, 200, {
      ok: true,
      rate,
      codAmount,
      lineTotal,
      bostaResponse,
      insertedOrder
    });
  } catch (error) {
    console.error('Bosta label creation failed:', error);
    return sendJson(res, 500, {
      ok: false,
      error: error.message
    });
  }
};

