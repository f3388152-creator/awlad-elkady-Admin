const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();

function token(req) {
  const value = req.headers.cookie?.split(';')
    .map(x => x.trim())
    .find(x => x.startsWith('admin_session='));
  return value?.slice('admin_session='.length);
}

function isPrimaryAdmin(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  const role = user?.app_metadata?.role;
  const confirmed = Boolean(user?.email_confirmed_at);
  return role === 'admin' || (Boolean(ADMIN_EMAIL) && email === ADMIN_EMAIL && confirmed);
}

async function isAdmin(req) {
  const access = token(req);
  if (!access || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` }
    });
    if (!response.ok) return false;
    const user = await response.json();
    return isPrimaryAdmin(user);
  } catch (_) {
    return false;
  }
}

module.exports = { token, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY, ADMIN_EMAIL, isPrimaryAdmin };
