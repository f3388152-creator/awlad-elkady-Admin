const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL) return res.status(503).json({ error: 'Authentication is not configured' });
  try {
    const { password, employeePhone } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (typeof password !== 'string' || !password || /^(123456|admin)$/i.test(password)) return res.status(401).json({ error: 'Invalid credentials' });
    const ownerLogin = !String(employeePhone || '').trim();
    let loginEmail = ADMIN_EMAIL;
    let isAdmin = false;
    if (!ownerLogin) {
      if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Employee authentication is not configured' });
      const phone = String(employeePhone).replace(/[^0-9+]/g, '').slice(0, 20);
      const staffResponse = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=login_email,is_active&phone=eq.${encodeURIComponent(phone)}&limit=1`, {
        headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` }
      });
      if (!staffResponse.ok) return res.status(401).json({ error: 'Invalid employee credentials' });
      const staffRows = await staffResponse.json();
      const staff = staffRows[0];
      if (!staff?.is_active || !staff.login_email) return res.status(401).json({ error: 'Employee account is inactive or invalid' });
      loginEmail = staff.login_email;
    }
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password }) });
    const data = await auth.json();
    if (!auth.ok || !data?.access_token) return res.status(401).json({ error: 'Invalid credentials' });
    const claims = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url').toString('utf8'));
    if (!claims.sub) return res.status(401).json({ error: 'Invalid credentials' });
    const authenticatedEmail = String(claims.email || data.user?.email || '').trim().toLowerCase();
    if (ownerLogin) {
      isAdmin = authenticatedEmail === String(ADMIN_EMAIL).trim().toLowerCase();
      if (!isAdmin) return res.status(403).json({ error: 'Owner account is not authorized' });
    }
    const sessionType = isAdmin ? 'owner' : 'employee';
    const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const cookie = [`admin_session=${data.access_token}`, 'HttpOnly', 'Path=/', 'SameSite=Strict', `Max-Age=${Math.min(data.expires_in || 3600, 3600)}`];
    if (secure) cookie.push('Secure');
    const roleCookie = [`admin_session_type=${sessionType}`, 'HttpOnly', 'Path=/', 'SameSite=Strict', `Max-Age=${Math.min(data.expires_in || 3600, 3600)}`];
    if (secure) roleCookie.push('Secure');
    res.setHeader('Set-Cookie', [cookie.join('; '), roleCookie.join('; ')]);
    return res.status(200).json({ ok: true, admin: isAdmin });
  } catch (_) { return res.status(500).json({ error: 'Authentication failed' }); }
};
