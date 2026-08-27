const { isOwner } = require('../lib/admin-session');
const { listStaff, createStaff, updateStaff, cleanStaff } = require('../lib/_staff');

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (_) { return {}; }
}

function fail(res, status, error) { return res.status(status).json({ error }); }

module.exports = async (req, res) => {
  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(req.method)) return fail(res, 405, 'Method not allowed');
  if (!(await isOwner(req))) return fail(res, 401, 'Owner session required');
  try {
    if (req.method === 'GET') return res.status(200).json((await listStaff()).map(cleanStaff));
    const payload = body(req);
    if (req.method === 'PATCH' && String(req.query?.scope || '') === 'all') {
      const { supabase } = require('../lib/_server');
      const patch = {};
      if (payload.session_enabled !== undefined) patch.session_enabled = Boolean(payload.session_enabled);
      if (payload.session_minutes !== undefined) {
        const minutes = Number(payload.session_minutes);
        if (!Number.isInteger(minutes) || minutes < 15 || minutes > 43200) return fail(res, 400, 'INVALID_SESSION_MINUTES');
        patch.session_minutes = minutes;
      }
      if (!Object.keys(patch).length) return fail(res, 400, 'Missing session settings');
      await supabase('/rest/v1/staff_accounts?id=not.is.null', 'PATCH', patch, 'return=minimal');
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'POST') {
      const row = await createStaff({
        phone: payload.phone,
        display_name: payload.display_name,
        password: payload.password,
        permissions: payload.permissions,
        session_enabled: payload.session_enabled,
        session_minutes: payload.session_minutes
      });
      return res.status(201).json(row);
    }
    const id = String(req.query?.id || payload.id || '');
    if (!id) return fail(res, 400, 'Missing staff id');
    if (req.method === 'DELETE') {
      const row = await updateStaff(id, { is_active: false });
      return res.status(200).json(row);
    }
    const row = await updateStaff(id, payload);
    return res.status(200).json(row);
  } catch (error) {
    const known = new Set(['INVALID_PHONE', 'INVALID_PASSWORD', 'INVALID_NAME', 'STAFF_EXISTS', 'STAFF_NOT_FOUND', 'INVALID_SESSION_MINUTES', 'STAFF_RECORD_CREATE_FAILED']);
    if (known.has(error.message)) return fail(res, error.status || 400, error.message);
    const remote = String(error.data?.msg || error.data?.message || error.data?.error_description || '').toLowerCase();
    if (error.message === 'SUPABASE_AUTH_ADMIN_FAILED' && /already registered|already exists|duplicate/.test(remote)) return fail(res, 409, 'STAFF_EXISTS');
    if (error.message === 'SUPABASE_AUTH_ADMIN_FAILED' && /email|invalid.*user/.test(remote)) return fail(res, 502, 'تعذر إنشاء حساب دخول الموظف؛ تحقق من إعدادات Auth في Supabase.');
    if (error.message === 'SUPABASE_REQUEST_FAILED' && /staff_accounts|schema cache|column|relation/.test(remote)) return fail(res, 502, 'جدول الموظفين غير محدث في Supabase؛ نفّذ Migration الموظفين ثم أعد المحاولة.');
    console.error('[staff-operation]', error.message, error.status || '', remote.slice(0, 180));
    return fail(res, error.status || 500, 'تعذر تنفيذ عملية الموظف حالياً. راجع إعدادات Supabase أو أعد المحاولة.');
  }
};
