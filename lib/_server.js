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

const EGYPT_COUNTRY_ID = '60e4482c7cb7d4bc4849c4d5';
let bostaLocationsCache = { expiresAt: 0, rows: null };

function normalizeArabic(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ');
}

async function getBostaLocations() {
  if (bostaLocationsCache.rows && bostaLocationsCache.expiresAt > Date.now()) return bostaLocationsCache.rows;
  const response = await fetch(`${BOSTA_BASE_URL}/cities/getAllDistricts?countryId=${EGYPT_COUNTRY_ID}`);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!response.ok || !Array.isArray(data?.data)) {
    const error = new Error('BOSTA_LOCATIONS_FAILED');
    error.status = response.status || 502;
    error.data = data;
    throw error;
  }
  const rows = data.data.flatMap(city => (Array.isArray(city.districts) ? city.districts : []).map(district => ({
    cityId: String(city.cityId || ''),
    cityName: city.cityName || '',
    cityOtherName: city.cityOtherName || '',
    districtId: String(district.districtId || ''),
    districtName: district.districtName || '',
    districtOtherName: district.districtOtherName || '',
    dropOffAvailability: district.dropOffAvailability !== false
  }))).filter(row => row.cityId && row.districtId && row.dropOffAvailability);
  bostaLocationsCache = { expiresAt: Date.now() + 10 * 60 * 1000, rows };
  return rows;
}

async function resolveBostaAddress(order) {
  const governorate = normalizeArabic(order.governorate);
  const area = normalizeArabic(order.area);
  if (!governorate || !area) throw new Error('BOSTA_ADDRESS_INCOMPLETE');
  const locations = await getBostaLocations();
  const cityRows = locations.filter(row => [row.cityName, row.cityOtherName].some(value => normalizeArabic(value) === governorate));
  if (!cityRows.length) throw new Error('BOSTA_CITY_NOT_FOUND');
  const district = cityRows.find(row => [row.districtName, row.districtOtherName].some(value => normalizeArabic(value) === area));
  if (!district) throw new Error('BOSTA_DISTRICT_NOT_FOUND');
  return {
    city: district.cityName,
    cityId: district.cityId,
    districtId: district.districtId,
    districtName: district.districtName,
    firstLine: String(order.address || '').trim(),
    secondLine: String(order.area || '').trim()
  };
}

function normalizeBostaPackageType(value) {
  const normalized = String(value || 'Small').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const allowed = {
    parcel: 'Parcel',
    document: 'Document',
    small: 'Small',
    medium: 'Medium',
    large: 'Large',
    'light bulky': 'Light Bulky',
    'heavy bulky': 'Heavy Bulky'
  };
  return allowed[normalized] || 'Small';
}

async function bostaPayload(order, packageTypeOverride) {
  const items = Array.isArray(order.items) ? order.items : [];
  const description = items.map(item => `${item.name || 'منتج'} × ${Number(item.qty || 1)}`).join('، ').slice(0, 500);
  const packageType = normalizeBostaPackageType(packageTypeOverride || process.env.BOSTA_DEFAULT_PACKAGE_TYPE || 'Small');
  const dropOffAddress = await resolveBostaAddress(order);
  return {
    type: 10,
    businessReference: `AWK-${order.id}`,
    businessLocationId: BUSINESS_LOCATION_ID,
    dropOffAddress,
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
  const payload = await bostaPayload(order, packageTypeOverride);
  const response = await fetch(`${BOSTA_BASE_URL}/deliveries?apiVersion=1`, {
    method: 'POST',
    headers: { Authorization: BOSTA_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) { const error = new Error('BOSTA_REQUEST_FAILED'); error.status = response.status; error.data = data; throw error; }
  return data;
}

async function bostaMutationAt(baseUrl, path, method = 'DELETE', body) {
  if (!BOSTA_API_KEY) throw Object.assign(new Error('BOSTA_SERVER_ENV_MISSING'), { status: 503 });
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { Authorization: BOSTA_API_KEY, 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body || {})
  });
  const text = await response.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) {
    const error = new Error('BOSTA_MUTATION_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function terminateBostaDelivery(deliveryId) {
  const id = encodeURIComponent(String(deliveryId || '').trim());
  if (!id) throw Object.assign(new Error('BOSTA_DELIVERY_ID_REQUIRED'), { status: 422 });
  return bostaMutationAt('https://app.bosta.co/api/v1', `/deliveries/${id}`, 'DELETE');
}

async function deleteBostaPickup(pickupId) {
  const id = encodeURIComponent(String(pickupId || '').trim());
  if (!id) throw Object.assign(new Error('BOSTA_PICKUP_ID_REQUIRED'), { status: 422 });
  return bostaMutationAt('https://app.bosta.co/api/v1', `/pickups/${id}`, 'DELETE');
}

function webhookAuthorized(req) {
  if (!WEBHOOK_AUTH_TOKEN) return false;
  const header = String(req.headers[WEBHOOK_HEADER_NAME] || req.headers['x-bosta-webhook-key'] || req.headers.authorization || '');
  return header === WEBHOOK_AUTH_TOKEN || header === `Bearer ${WEBHOOK_AUTH_TOKEN}`;
}

module.exports = { SUPABASE_URL, BOSTA_API_KEY, BOSTA_BASE_URL, BUSINESS_LOCATION_ID, WEBHOOK_AUTH_TOKEN, cors, json, parseBody, supabase, createBostaDelivery, getBostaLocations, terminateBostaDelivery, deleteBostaPickup, webhookAuthorized };
