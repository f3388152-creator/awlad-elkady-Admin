const { token, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./admin-session');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const access = token(req);
  if (access && await isAdmin(req)) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` } });
  res.setHeader('Set-Cookie', 'admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0');
  res.status(204).end();
};
