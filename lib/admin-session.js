const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function token(req) {
  const value = req.headers.cookie?.split(';')
    .map(x => x.trim())
    .find(x => x.startsWith('admin_session='));
  return value?.slice('admin_session='.length);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isPrimaryAdmin(user) {
  const email = normalizeEmail(user?.email);
  const role = user?.app_metadata?.role;
  return role === 'admin' || (Boolean(ADMIN_EMAIL) && email === ADMIN_EMAIL && Boolean(user?.email_confirmed_at));
}

async function getSessionUser(req) {
  const access = token(req);
  if (!access || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` }
    });
    if (!response.ok) return null;
    return await response.json();
  } catch (_) {
    return null;
  }
}

function normalizePermissions(value) {
  if (Array.isArray(value)) return Object.fromEntries(value.map(name => [String(name), true]));
  if (typeof value === 'string') {
    try { return normalizePermissions(JSON.parse(value)); } catch (_) { return {}; }
  }
  return value && typeof value === 'object' ? value : {};
}

function getPermissions(user) {
  return normalizePermissions(user?.app_metadata?.permissions);
}

function hasPermissionInMap(permissions, permission) {
  const required = Array.isArray(permission) ? permission : [permission];
  return required.length > 0 && required.every(name => permissions[name] === true || permissions['*'] === true);
}

function hasPermission(user, permission) {
  if (isPrimaryAdmin(user)) return true;
  return hasPermissionInMap(getPermissions(user), permission);
}

async function getEffectivePermissions(user) {
  if (isPrimaryAdmin(user)) return { '*': true };
  const metadataPermissions = getPermissions(user);
  const staffId = user?.app_metadata?.staff_id;
  if (!staffId || !SUPABASE_URL || !SERVICE_ROLE_KEY) return metadataPermissions;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=permissions&id=eq.${encodeURIComponent(String(staffId))}&limit=1`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
    });
    if (!response.ok) return metadataPermissions;
    const rows = await response.json();
    return rows?.[0] ? normalizePermissions(rows[0].permissions) : metadataPermissions;
  } catch (_) {
    return metadataPermissions;
  }
}

async function isActiveStaff(user) {
  if (!user || user.app_metadata?.role !== 'staff' || !user.app_metadata?.staff_id || !SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=id,auth_user_id,is_active&id=eq.${encodeURIComponent(String(user.app_metadata.staff_id))}&limit=1`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` }
    });
    if (!response.ok) return false;
    const rows = await response.json();
    const row = rows?.[0];
    return Boolean(row && row.is_active !== false && String(row.auth_user_id) === String(user.id));
  } catch (_) {
    return false;
  }
}

async function isAdmin(req) {
  const user = await getSessionUser(req);
  if (!user) return false;
  if (isPrimaryAdmin(user)) return true;
  return isActiveStaff(user);
}

async function isOwner(req) {
  const user = await getSessionUser(req);
  return Boolean(user && isPrimaryAdmin(user));
}

async function authorize(req, permission) {
  const user = await getSessionUser(req);
  if (!user) return { ok: false, status: 401, user: null };
  if (!isPrimaryAdmin(user) && !(await isActiveStaff(user))) return { ok: false, status: 401, user: null };
  const permissions = await getEffectivePermissions(user);
  if (!isPrimaryAdmin(user) && !hasPermissionInMap(permissions, permission)) return { ok: false, status: 403, user, permissions };
  return { ok: true, status: 200, user, permissions };
}

module.exports = {
  token,
  getSessionUser,
  isAdmin,
  isOwner,
  authorize,
  hasPermission,
  isPrimaryAdmin,
  getPermissions,
  getEffectivePermissions,
  isActiveStaff,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SERVICE_ROLE_KEY,
  ADMIN_EMAIL
};
