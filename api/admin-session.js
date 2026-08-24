const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
function token(req) { const value = req.headers.cookie?.split(';').map(x => x.trim()).find(x => x.startsWith('admin_session=')); return value?.slice('admin_session='.length); }
async function isAdmin(req) {
  const access = token(req); if (!access || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` } });
  if (!response.ok) return false;
  const user = await response.json(); return user.app_metadata?.role === 'admin';
}
module.exports = { token, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY };
