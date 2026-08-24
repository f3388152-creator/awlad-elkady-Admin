const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL) return res.status(503).json({ error: 'Authentication is not configured' });
  try {
    const { password } = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    if (typeof password !== 'string' || !password || /^(123456|admin)$/i.test(password)) return res.status(401).json({ error: 'Invalid credentials' });
    const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: ADMIN_EMAIL, password }) });
    const data = await auth.json();
    if (!auth.ok || !data.access_token) return res.status(401).json({ error: 'Invalid credentials' });
    const claims = JSON.parse(Buffer.from(data.access_token.split('.')[1], 'base64url').toString('utf8'));
    if (claims.app_metadata?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production';
    const cookie = [`admin_session=${data.access_token}`, 'HttpOnly', 'Path=/', 'SameSite=Strict', `Max-Age=${Math.min(data.expires_in || 3600, 3600)}`];
    if (secure) cookie.push('Secure');
    res.setHeader('Set-Cookie', cookie.join('; '));
    return res.status(200).json({ ok: true });
  } catch (_) { return res.status(500).json({ error: 'Authentication failed' }); }
};
