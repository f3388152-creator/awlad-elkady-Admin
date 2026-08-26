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
  return permissions[permission] === true;
}

async function isAdmin(req) {
  const user = await getSessionUser(req);
  return Boolean(user && (isPrimaryAdmin(user) || user.app_metadata?.role === 'staff'));
}

async function isOwner(req) {
  const user = await getSessionUser(req);
  return Boolean(user && isPrimaryAdmin(user));
}

async function authorize(req, permission) {
  const user = await getSessionUser(req);
  if (!user || !(isPrimaryAdmin(user) || user.app_metadata?.role === 'staff')) {
    return { ok: false, status: 401, user: null };
  }
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
