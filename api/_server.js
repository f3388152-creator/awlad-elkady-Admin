const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BOSTA_API_KEY = process.env.BOSTA_API_KEY || '';
const BOSTA_BASE_URL = process.env.BOSTA_BASE_URL || 'https://app.bosta.co/api/v2';
const BUSINESS_LOCATION_ID = process.env.BOSTA_BUSINESS_LOCATION_ID || '';
const WEBHOOK_AUTH_TOKEN = process.env.BOSTA_WEBHOOK_AUTH_TOKEN || '';
const WEBHOOK_HEADER_NAME = String(process.env.BOSTA_WEBHOOK_HEADER_NAME || 'x-bosta-webhook-key').toLowerCase();
const ALLOWED_ORIGINS = new Set([
  'https://awlad-elkady-store.vercel.app',
  'https://awlad-elkady-admin.vercel.app',
  'http://127.0.0.1:4173',
  'http://localhost:4173'
]);

function origin(req) {
  const value = String(req.headers.origin || '');
  return ALLOWED_ORIGINS.has(value) ? value : 'https://awlad-elkady-store.vercel.app';
}

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', origin(req));
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Bosta-Webhook-Key');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function json(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.send(JSON.stringify(payload));
}

function parseBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

async function supabase(path, method = 'GET', body, prefer = 'return=representation') {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVER_ENV_MISSING');
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: prefer
    },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) { const error = new Error('SUPABASE_REQUEST_FAILED'); error.status = response.status; error.data = data; throw error; }
  return data;
}

function bostaPayload(order, packageTypeOverride) {
  const items = Array.isArray(order.items) ? order.items : [];
  const description = items.map(item => `${item.name || 'منتج'} × ${Number(item.qty || 1)}`).join('، ').slice(0, 500);
  const packageType = String(packageTypeOverride || process.env.BOSTA_DEFAULT_PACKAGE_TYPE || 'SMALL');
  return {
    type: 10,
    businessReference: `AWK-${order.id}`,
    businessLocationId: BUSINESS_LOCATION_ID,
    dropOffAddress: {
      city: order.governorate,
      firstLine: order.address,
      secondLine: order.area || undefined
    },
    receiver: {
      firstName: order.customer_name,
      lastName: '',
      phone: order.customer_phone
    },
    cod: Number(order.total || 0),
    specs: {
      packageType,
      packageDetails: { description, itemsCount: items.reduce((sum, item) => sum + Number(item.qty || 1), 0) }
    },
    goodsInfo: { description, itemsCount: items.length }
  };
}

async function createBostaDelivery(order, packageTypeOverride) {
  if (!BOSTA_API_KEY || !BUSINESS_LOCATION_ID) throw new Error('BOSTA_SERVER_ENV_MISSING');
  const response = await fetch(`${BOSTA_BASE_URL}/deliveries?apiVersion=1`, {
    method: 'POST',
    headers: { Authorization: BOSTA_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(bostaPayload(order, packageTypeOverride))
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) { const error = new Error('BOSTA_REQUEST_FAILED'); error.status = response.status; error.data = data; throw error; }
  return data;
}

function webhookAuthorized(req) {
  if (!WEBHOOK_AUTH_TOKEN) return false;
  const header = String(req.headers[WEBHOOK_HEADER_NAME] || req.headers['x-bosta-webhook-key'] || req.headers.authorization || '');
  return header === WEBHOOK_AUTH_TOKEN || header === `Bearer ${WEBHOOK_AUTH_TOKEN}`;
}

module.exports = { SUPABASE_URL, BOSTA_API_KEY, BUSINESS_LOCATION_ID, WEBHOOK_AUTH_TOKEN, cors, json, parseBody, supabase, createBostaDelivery, webhookAuthorized };
