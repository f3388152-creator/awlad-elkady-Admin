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

function getPermissions(user) {
  const permissions = user?.app_metadata?.permissions;
  return permissions && typeof permissions === 'object' ? permissions : {};
}

function hasPermission(user, permission) {
  if (isPrimaryAdmin(user)) return true;
  const permissions = getPermissions(user);
  const required = Array.isArray(permission) ? permission : [permission];
  return required.length > 0 && required.every(name => permissions[name] === true);
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
  if (!hasPermission(user, permission)) return { ok: false, status: 403, user };
  return { ok: true, status: 200, user };
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
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SERVICE_ROLE_KEY,
  ADMIN_EMAIL
};
