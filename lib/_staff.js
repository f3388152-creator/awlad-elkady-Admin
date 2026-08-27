const { SUPABASE_URL, supabase } = require('./_server');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function normalizePhone(value) {
  const converted = String(value || '')
    .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
  const digits = converted.replace(/[^0-9]/g, '');
  return digits.startsWith('20') && digits.length === 12 ? `0${digits.slice(2)}` : digits;
}

function validPhone(phone) {
  return /^01[0125][0-9]{8}$/.test(phone);
}

function loginEmail(phone) {
  return `staff-${phone}@staff.awladelkady.local`;
}

async function authAdmin(path, method = 'GET', body) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('SUPABASE_SERVER_ENV_MISSING');
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users${path}`, {
    method,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: method === 'GET' ? undefined : JSON.stringify(body || {})
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) {
    const error = new Error('SUPABASE_AUTH_ADMIN_FAILED');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function cleanStaff(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    display_name: row.display_name,
    permissions: row.permissions || {},
    is_active: row.is_active !== false,
    session_enabled: row.session_enabled !== false,
    session_minutes: Number(row.session_minutes) || 60,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

async function findByPhone(phone) {
  const rows = await supabase(`/rest/v1/staff_accounts?select=*&phone=eq.${encodeURIComponent(phone)}&limit=1`);
  return rows?.[0] || null;
}

async function findById(id) {
  const rows = await supabase(`/rest/v1/staff_accounts?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return rows?.[0] || null;
}

async function listStaff() {
  return (await supabase('/rest/v1/staff_accounts?select=*&order=created_at.desc')) || [];
}

async function createStaff({ phone, display_name, password, permissions, session_enabled = true, session_minutes = 60 }) {
  const normalized = normalizePhone(phone);
  if (!validPhone(normalized)) throw Object.assign(new Error('INVALID_PHONE'), { status: 400 });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw Object.assign(new Error('INVALID_PASSWORD'), { status: 400 });
  if (!String(display_name || '').trim()) throw Object.assign(new Error('INVALID_NAME'), { status: 400 });
  const existing = await findByPhone(normalized);
  if (existing) throw Object.assign(new Error('STAFF_EXISTS'), { status: 409 });
  const minutes = Number(session_minutes);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 43200) throw Object.assign(new Error('INVALID_SESSION_MINUTES'), { status: 400 });

  const email = loginEmail(normalized);
  const user = await authAdmin('', 'POST', {
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'staff', permissions: permissions || {} },
    user_metadata: { phone: normalized, display_name: String(display_name).trim() }
  });
  try {
    const rows = await supabase('/rest/v1/staff_accounts', 'POST', {
      auth_user_id: user.id,
      phone: normalized,
      display_name: String(display_name).trim(),
      login_email: email,
      permissions: permissions || {},
      is_active: true,
      session_enabled: session_enabled !== false,
      session_minutes: minutes
    });
    const row = rows?.[0];
    if (!row?.id) throw Object.assign(new Error('STAFF_RECORD_CREATE_FAILED'), { status: 502 });
    if (row?.id) {
      await authAdmin(`/${encodeURIComponent(user.id)}`, 'PUT', {
        app_metadata: { role: 'staff', permissions: permissions || {}, staff_id: row.id },
        user_metadata: { phone: normalized, display_name: String(display_name).trim(), staff_id: row.id }
      });
    }
    return cleanStaff(row);
  } catch (error) {
    try { await authAdmin(`/${encodeURIComponent(user.id)}`, 'DELETE'); } catch (_) {}
    throw error;
  }
}

async function deleteStaff(id) {
  const current = await findById(id);
  if (!current) throw Object.assign(new Error('STAFF_NOT_FOUND'), { status: 404 });
  try {
    await authAdmin(`/${encodeURIComponent(current.auth_user_id)}`, 'DELETE');
  } catch (error) {
    if (error.status !== 404) throw Object.assign(new Error('STAFF_DELETE_FAILED'), { status: error.status || 502, data: error.data });
  }
  await supabase(`/rest/v1/staff_accounts?id=eq.${encodeURIComponent(id)}`, 'DELETE', {}, 'return=minimal');
  return { ok: true };
}

async function updateStaff(id, patch) {
  const current = await findById(id);
  if (!current) throw Object.assign(new Error('STAFF_NOT_FOUND'), { status: 404 });
  const next = {};
  if (patch.display_name !== undefined) {
    const name = String(patch.display_name || '').trim();
    if (!name) throw Object.assign(new Error('INVALID_NAME'), { status: 400 });
    next.display_name = name;
  }
  if (patch.permissions !== undefined) next.permissions = patch.permissions && typeof patch.permissions === 'object' ? patch.permissions : {};
  if (patch.is_active !== undefined) next.is_active = Boolean(patch.is_active);
  if (patch.session_enabled !== undefined) next.session_enabled = Boolean(patch.session_enabled);
  if (patch.session_minutes !== undefined) {
    const minutes = Number(patch.session_minutes);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 43200) throw Object.assign(new Error('INVALID_SESSION_MINUTES'), { status: 400 });
    next.session_minutes = minutes;
  }
  if (Object.keys(next).length) await supabase(`/rest/v1/staff_accounts?id=eq.${encodeURIComponent(id)}`, 'PATCH', next, 'return=minimal');

  const authPatch = {};
  if (patch.password !== undefined) {
    if (typeof patch.password !== 'string' || patch.password.length < 8 || patch.password.length > 128) throw Object.assign(new Error('INVALID_PASSWORD'), { status: 400 });
    authPatch.password = patch.password;
  }
  if (patch.permissions !== undefined || patch.display_name !== undefined) {
    authPatch.app_metadata = { role: 'staff', permissions: next.permissions || current.permissions || {}, staff_id: id };
    authPatch.user_metadata = { phone: current.phone, display_name: next.display_name || current.display_name, staff_id: id };
  }
  if (patch.is_active !== undefined) authPatch.ban_duration = patch.is_active ? 'none' : '876000h';
  if (Object.keys(authPatch).length) await authAdmin(`/${encodeURIComponent(current.auth_user_id)}`, 'PUT', authPatch);
  return cleanStaff(await findById(id));
}

module.exports = { normalizePhone, validPhone, loginEmail, cleanStaff, findByPhone, findById, listStaff, createStaff, updateStaff, deleteStaff };
