const { isOwner } = require('./admin-session');
const { listStaff, createStaff, updateStaff, cleanStaff } = require('./_staff');

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
    if (req.method === 'POST') {
      const row = await createStaff({
        phone: payload.phone,
        display_name: payload.display_name,
        password: payload.password,
        permissions: payload.permissions
      });
      return res.status(201).json(row);
    }
    const id = String(req.query?.id || payload.id || '');
    if (!id) return fail(res, 400, 'Missing staff id');
    const row = await updateStaff(id, payload);
    return res.status(200).json(row);
  } catch (error) {
    const known = new Set(['INVALID_PHONE', 'INVALID_PASSWORD', 'INVALID_NAME', 'STAFF_EXISTS', 'STAFF_NOT_FOUND']);
    return fail(res, known.has(error.message) ? (error.status || 400) : (error.status || 500), known.has(error.message) ? error.message : 'Staff operation failed');
  }
};
