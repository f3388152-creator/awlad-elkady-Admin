const { token, getSessionUser, isAdmin, isOwner, SUPABASE_URL, SUPABASE_ANON_KEY } = require('../lib/admin-session');
const { listStaff, createStaff, updateStaff, deleteStaff, cleanStaff, forceLogoutStaff } = require('../lib/_staff');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const isAuthenticated = async req => Boolean(await getSessionUser(req));
function parseBody(req) { if (req.body && typeof req.body === 'object') return req.body; try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; } }
function secureCookies(req) { return req.headers['x-forwarded-proto'] === 'https' || process.env.NODE_ENV === 'production'; }
function setSessionCookies(res, req, access, refresh, maxAge = 3600) {
  const secure = secureCookies(req); const flags = `HttpOnly; Path=/; SameSite=Strict${secure ? '; Secure' : ''}`;
  res.setHeader('Set-Cookie', [`admin_session=${encodeURIComponent(access || '')}; ${flags}; Max-Age=${Math.max(0, maxAge)}`, `admin_refresh=${encodeURIComponent(refresh || '')}; ${flags}; Max-Age=${Math.max(0, maxAge)}`]);
}
async function authenticate(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !ADMIN_EMAIL) return res.status(503).json({ error: 'Authentication is not configured' });
  const { password, employeePhone } = parseBody(req); if (typeof password !== 'string' || !password) return res.status(401).json({ error: 'Invalid credentials' });
  let loginEmail = ADMIN_EMAIL; let ownerLogin = !String(employeePhone || '').trim();
  if (!ownerLogin) {
    if (!SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Employee authentication is not configured' });
    const phone = String(employeePhone).replace(/[^0-9+]/g, '').slice(0, 20);
    const staffResponse = await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?select=login_email,is_active,permissions,id,session_version&phone=eq.${encodeURIComponent(phone)}&limit=1`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
    const rows = staffResponse.ok ? await staffResponse.json() : []; const staff = rows[0];
    if (!staff?.is_active || !staff.login_email) return res.status(401).json({ error: 'Invalid employee credentials' }); loginEmail = staff.login_email;
    req.staffPermissions = staff.permissions || {};
    req.staffRecord = staff;
  }
  const auth = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: loginEmail, password }) });
  const data = await auth.json(); if (!auth.ok || !data?.access_token) return res.status(401).json({ error: 'Invalid credentials' });
  const email = String(data.user?.email || '').trim().toLowerCase(); const admin = ownerLogin && email === ADMIN_EMAIL;
  if (ownerLogin && !admin) return res.status(403).json({ error: 'Owner account is not authorized' });
  if (!ownerLogin && req.staffRecord && SUPABASE_SERVICE_ROLE_KEY) {
    await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${encodeURIComponent(String(req.staffRecord.id))}`, { method: 'PATCH', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ last_user_agent: String(req.headers['user-agent'] || '').slice(0, 1000), last_login_at: new Date().toISOString(), is_online: true, last_seen_at: new Date().toISOString() }) });
  }
  const requestedMaxAge = ownerLogin ? 30 * 24 * 3600 : (req.staffRecord?.session_enabled === false ? Math.min(data.expires_in || 3600, 3600) : Math.max(900, Math.min(Number(req.staffRecord?.session_minutes || 43200) * 60, 30 * 24 * 3600)));
  setSessionCookies(res, req, data.access_token, data.refresh_token, requestedMaxAge); return res.status(200).json({ ok: true, admin, permissions: req.staffPermissions || { '*': true } });
}
async function logout(req, res) { if (req.method !== 'POST') return res.status(405).end(); const access = token(req); if (access && await isAdmin(req)) await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${access}` } }); setSessionCookies(res, req, '', 0); return res.status(204).end(); }
module.exports = async (req, res) => {
  const { table, action = 'select', id, fn, bulk } = req.query;
  if (action === 'auth') return authenticate(req, res);
  if (action === 'logout') return logout(req, res);
  if (action === 'check') {
    const authenticated = await isAuthenticated(req);
    const admin = authenticated && await isAdmin(req);
    return res.status(authenticated ? 200 : 401).json({ authenticated, admin });
  }
  if (action === 'bulk-import' || bulk === '1') {
    if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin role required for bulk import' });
    return res.status(200).json({ ok: true, bulkImport: true });
  }
  if (action === 'profile-requests') {
    const user = await getSessionUser(req);
    if (!user || !SUPABASE_SERVICE_ROLE_KEY) return res.status(401).json({ error: 'Staff session required' });
    const owner = await isOwner(req);
    const ownId = user?.app_metadata?.staff_id;
    if (req.method === 'GET') {
      const filter = owner ? '' : `&staff_id=eq.${encodeURIComponent(String(ownId))}`;
      const rows = await fetch(`${SUPABASE_URL}/rest/v1/profile_requests?select=*&order=created_at.desc${filter}`, { headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` } });
      return res.status(rows.status).send(await rows.text());
    }
    const payload = parseBody(req);
    if (req.method === 'POST') {
      if (!ownId || !String(payload.reason || '').trim()) return res.status(400).json({ error: 'Reason is required' });
      const response = await fetch(`${SUPABASE_URL}/rest/v1/profile_requests`, { method: 'POST', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify({ staff_id: ownId, reason: String(payload.reason).trim().slice(0, 2000), request_type: 'password_change' }) });
      return res.status(response.status).send(await response.text());
    }
    if (req.method === 'PATCH' && owner && id) {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/profile_requests?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ status: payload.status, admin_reason: String(payload.admin_reason || '').slice(0, 2000), reviewed_by: user.email, reviewed_at: new Date().toISOString() }) });
      return res.status(response.status).send(await response.text());
    }
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (action === 'presence') {
    const user = await getSessionUser(req); const staffId = user?.app_metadata?.staff_id;
    if (!user || !staffId || !SUPABASE_SERVICE_ROLE_KEY) return res.status(401).json({ error: 'Staff session required' });
    const online = req.method !== 'DELETE';
    await fetch(`${SUPABASE_URL}/rest/v1/staff_accounts?id=eq.${encodeURIComponent(String(staffId))}`, { method: 'PATCH', headers: { apikey: SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ is_online: online, last_seen_at: new Date().toISOString() }) });
    return res.status(200).json({ ok: true, is_online: online });
  }
  if (action === 'staff') {
    if (!(await isOwner(req))) return res.status(401).json({ error: 'Owner session required' });
    if (req.method === 'GET') return res.status(200).json((await listStaff()).map(cleanStaff));
    const payload = parseBody(req); const staffId = String(id || payload.id || '');
    if (req.method === 'POST' && req.query.operation === 'force-logout') return res.status(200).json(await forceLogoutStaff(staffId));
    if (req.method === 'POST') return res.status(201).json(await createStaff(payload));
    if (!staffId) return res.status(400).json({ error: 'Missing staff id' });
    if (req.method === 'DELETE') return res.status(200).json(await deleteStaff(staffId));
    if (req.method === 'PATCH') return res.status(200).json(await updateStaff(staffId, payload));
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (table === 'staff_accounts' && !(await isAdmin(req))) return res.status(403).json({ error: 'Owner session required for staff management' });
  if (action !== 'bulk-import' && !(await isAuthenticated(req))) return res.status(401).json({ error: 'Authenticated session required' });
  if (!table && action !== 'rpc') return res.status(400).json({ error: 'Missing resource' });
  const query = action === 'select'
    ? Object.entries(req.query || {}).filter(([key]) => !['table','action','id','fn','bulk'].includes(key)).map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`).join('&')
    : '';
  const path = action === 'rpc' ? `/rest/v1/rpc/${fn}` : `/rest/v1/${table}${id ? `?id=eq.${encodeURIComponent(id)}` : (action === 'select' ? `?select=*${query ? `&${query}` : ''}` : '')}`;
  const staffRequest = table === 'staff_accounts';
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY || token(req)}`,
    'Content-Type': req.headers['content-type'] || 'application/json'
  };
  const method = { select: 'GET', insert: 'POST', insertReturn: 'POST', update: 'PATCH', delete: 'DELETE', rpc: 'POST' }[action];
  if (!method) return res.status(400).json({ error: 'Unsupported action' });
  if (method !== 'GET') headers.Prefer = action === 'insertReturn' ? 'return=representation' : 'return=minimal';
  const upstream = await fetch(`${SUPABASE_URL}${path}`, { method, headers, body: method === 'GET' ? undefined : JSON.stringify(req.body || {}) });
  const text = await upstream.text(); res.status(upstream.status); if (text) res.send(text); else res.end();
};
