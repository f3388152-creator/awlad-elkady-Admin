const { token, isAuthenticated, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./admin-session');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
module.exports = async (req, res) => {
  const { table, action = 'select', id, fn, bulk } = req.query;
  if (bulk === '1' && !(await isAdmin(req))) return res.status(403).json({ error: 'Admin role required for bulk import' });
  if (table === 'staff_accounts' && !(await isAdmin(req))) return res.status(403).json({ error: 'Owner session required for staff management' });
  if (action !== 'bulk-import' && !(await isAuthenticated(req))) return res.status(401).json({ error: 'Authenticated session required' });
  if (!table && action !== 'rpc') return res.status(400).json({ error: 'Missing resource' });
  const query = typeof req.query === 'string' ? req.query : '';
  const path = action === 'rpc' ? `/rest/v1/rpc/${fn}` : `/rest/v1/${table}${id ? `?id=eq.${encodeURIComponent(id)}` : (action === 'select' ? `?select=*${query ? `&${query}` : ''}` : '')}`;
  const staffRequest = table === 'staff_accounts';
  const headers = {
    apikey: staffRequest && SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : SUPABASE_ANON_KEY,
    Authorization: `Bearer ${staffRequest && SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY : token(req)}`,
    'Content-Type': req.headers['content-type'] || 'application/json'
  };
  const method = { select: 'GET', insert: 'POST', insertReturn: 'POST', update: 'PATCH', delete: 'DELETE', rpc: 'POST' }[action];
  if (!method) return res.status(400).json({ error: 'Unsupported action' });
  if (method !== 'GET') headers.Prefer = action === 'insertReturn' ? 'return=representation' : 'return=minimal';
  const upstream = await fetch(`${SUPABASE_URL}${path}`, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(req.body || {}) });
  const text = await upstream.text(); res.status(upstream.status); if (text) res.send(text); else res.end();
};
