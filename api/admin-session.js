const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
function token(req) { const value = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('admin_session=')); return value?.slice('admin_session='.length); }
function sessionType(req) { const value = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('admin_session_type=')); return value?.slice('admin_session_type='.length); }
async function getUser(req) {
  const access = token(req); if (!access || !SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` } });
  if (!response.ok) return null;
  return response.json();
}
async function isAuthenticated(req) { return Boolean(await getUser(req)); }
async function isAdmin(req) {
  const user = await getUser(req);
  const emailIsAdmin = ADMIN_EMAIL && String(user?.email || '').trim().toLowerCase() === ADMIN_EMAIL;
  return Boolean(sessionType(req) === 'owner' && emailIsAdmin);
}
module.exports = { token, sessionType, getUser, isAuthenticated, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY };
