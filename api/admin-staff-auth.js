const { SUPABASE_URL, SUPABASE_ANON_KEY } = require('./admin-session');
const { normalizePhone, validPhone, loginEmail, findByPhone } = require('./_staff');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const phone = normalizePhone(body.phone);
    const password = String(body.password || '');
    if (!validPhone(phone) || password.length < 8) return res.status(401).json({ error: 'Invalid credentials' });
    const staff = await findByPhone(phone);
    if (!staff || staff.is_active === false) return res.status(401).json({ error: 'Invalid credentials' });

    const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail(phone), password })
    });
    const data = await auth.json();
    if (!auth.ok || !data.access_token) return res.status(401).json({ error: 'Invalid credentials' });
    if (data.user?.app_metadata?.role !== 'staff' || String(data.user?.app_metadata?.staff_id) !== String(staff.id)) return res.status(403).json({ error: 'Invalid staff account' });

    const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const cookie = [`admin_session=${data.access_token}`, 'HttpOnly', 'Path=/', 'SameSite=Strict'];
    if (staff.session_enabled !== false) cookie.push(`Max-Age=${Math.min(Math.max(Number(staff.session_minutes) || 60, 15) * 60, Number(data.expires_in) || 3600)}`);
    if (secure) cookie.push('Secure');
    const refreshCookie = [`admin_refresh=${encodeURIComponent(data.refresh_token || '')}`, 'HttpOnly', 'Path=/', 'SameSite=Strict', 'Max-Age=2592000'];
    if (secure) refreshCookie.push('Secure');
    res.setHeader('Set-Cookie', [cookie.join('; '), refreshCookie.join('; ')]);
    return res.status(200).json({ ok: true, role: 'staff', display_name: staff.display_name, permissions: staff.permissions || {} });
  } catch (_) {
    return res.status(500).json({ error: 'Authentication failed' });
  }
};
