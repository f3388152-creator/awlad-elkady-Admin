const {
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  getSessionUser,
  isPrimaryAdmin
} = require('../lib/admin-session');
const { findById, cleanStaff } = require('../lib/_staff');

function cookieValue(req, name) {
  const raw = String(req.headers.cookie || '')
    .split(';')
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`));
  if (!raw) return '';
  const value = raw.slice(name.length + 1);
  try { return decodeURIComponent(value); } catch (_) { return value; }
}

function cookieHeader(name, value, maxAge, secure) {
  const parts = [`${name}=${encodeURIComponent(value || '')}`, 'HttpOnly', 'Path=/', 'SameSite=Strict'];
  if (Number.isFinite(maxAge)) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

function clearCookies(secure) {
  return [cookieHeader('admin_session', '', 0, secure), cookieHeader('admin_refresh', '', 0, secure)];
}

async function refreshSession(refreshToken) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken })
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!response.ok || !data?.access_token || !data?.refresh_token) return null;
  return data;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
  const refreshToken = cookieValue(req, 'admin_refresh');
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !refreshToken) {
    res.setHeader('Set-Cookie', clearCookies(secure));
    return res.status(401).json({ error: 'Session expired' });
  }

  try {
    const data = await refreshSession(refreshToken);
    if (!data) {
      res.setHeader('Set-Cookie', clearCookies(secure));
      return res.status(401).json({ error: 'Session expired' });
    }

    const userResponse = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${data.access_token}` }
    });
    if (!userResponse.ok) {
      res.setHeader('Set-Cookie', clearCookies(secure));
      return res.status(401).json({ error: 'Session expired' });
    }
    const user = await userResponse.json();
    let sessionMaxAge = Math.min(Number(data.expires_in) || 3600, 3600);
    let staff = null;

    if (isPrimaryAdmin(user)) {
      sessionMaxAge = Math.min(Number(data.expires_in) || 3600, 3600);
    } else if (user?.app_metadata?.role === 'staff' && user?.app_metadata?.staff_id) {
      staff = await findById(String(user.app_metadata.staff_id));
      if (!staff || staff.is_active === false || String(staff.auth_user_id) !== String(user.id)) {
        res.setHeader('Set-Cookie', clearCookies(secure));
        return res.status(403).json({ error: 'Staff account disabled' });
      }
      if (staff.session_enabled === false) sessionMaxAge = null;
      else sessionMaxAge = Math.min(Math.max(Number(staff.session_minutes) || 60, 15) * 60, 2592000);
    } else {
      res.setHeader('Set-Cookie', clearCookies(secure));
      return res.status(403).json({ error: 'Forbidden' });
    }

    const accessCookie = cookieHeader('admin_session', data.access_token, sessionMaxAge, secure);
    const refreshCookie = cookieHeader('admin_refresh', data.refresh_token, 2592000, secure);
    res.setHeader('Set-Cookie', [accessCookie, refreshCookie]);
    return res.status(200).json({
      ok: true,
      role: staff ? 'staff' : 'admin',
      display_name: staff ? cleanStaff(staff).display_name : (user.user_metadata?.display_name || user.email || ''),
      permissions: staff ? cleanStaff(staff).permissions : {}
    });
  } catch (_) {
    res.setHeader('Set-Cookie', clearCookies(secure));
    return res.status(401).json({ error: 'Session expired' });
  }
};
