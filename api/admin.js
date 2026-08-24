const { token, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./admin-session');

const ALLOWED_TABLES = new Set([
  'products', 'categories', 'product_categories', 'orders', 'complaints',
  'site_settings', 'faqs', 'socials', 'shipping_rates'
]);
const ALLOWED_RPCS = new Set(['create_order_with_stock', 'create_order_with_stock_bulk', 'decrement_product_stock']);

function sendError(res, status, error) {
  return res.status(status).json({ error });
}

async function upstream(path, method, req, body, prefer = 'return=minimal') {
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token(req)}`,
    'Content-Type': req.headers['content-type'] || 'application/json',
    Prefer: prefer
  };
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers,
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {})
  });
  const text = await response.text();
  return { response, text };
}

module.exports = async (req, res) => {
  if (!(await isAdmin(req))) return sendError(res, 401, 'Admin session required');

  const params = req.query || {};
  const table = typeof params.table === 'string' ? params.table : '';
  const action = typeof params.action === 'string' ? params.action : 'select';
  const id = params.id;
  const fn = params.fn;

  if (action === 'rpc') {
    if (!ALLOWED_RPCS.has(fn)) return sendError(res, 400, 'Unsupported RPC');
    const result = await upstream(`/rest/v1/rpc/${fn}`, 'POST', req, req.body || {}, 'return=representation');
    res.status(result.response.status);
    return result.text ? res.send(result.text) : res.end();
  }

  if (!ALLOWED_TABLES.has(table)) return sendError(res, 400, 'Unsupported resource');

  if (action === 'replace_product_categories') {
    const productId = Number(id);
    const categoryIds = Array.isArray(req.body?.category_ids)
      ? req.body.category_ids.map(Number).filter(Number.isInteger)
      : [];
    if (!Number.isInteger(productId) || categoryIds.some(value => value <= 0)) {
      return sendError(res, 400, 'Invalid product categories');
    }
    const removed = await upstream(`/rest/v1/product_categories?product_id=eq.${productId}`, 'DELETE', req, undefined);
    if (!removed.response.ok) {
      res.status(removed.response.status);
      return removed.text ? res.send(removed.text) : res.end();
    }
    if (categoryIds.length) {
      const inserted = await upstream('/rest/v1/product_categories', 'POST', req, categoryIds.map(category_id => ({ product_id: productId, category_id })), 'return=minimal');
      if (!inserted.response.ok) {
        res.status(inserted.response.status);
        return inserted.text ? res.send(inserted.text) : res.end();
      }
    }
    return res.status(204).end();
  }

  if (action === 'select') {
    const query = typeof params.query === 'string' ? params.query : '';
    const path = `/rest/v1/${table}?select=*${query ? `&${query}` : ''}`;
    const result = await upstream(path, 'GET', req, undefined, '');
    res.status(result.response.status);
    return result.text ? res.send(result.text) : res.end();
  }

  if (!['insert', 'insertReturn', 'update', 'delete'].includes(action)) return sendError(res, 400, 'Unsupported action');
  if (['update', 'delete'].includes(action) && (id === undefined || id === '')) return sendError(res, 400, 'Missing id');

  const encodedId = encodeURIComponent(String(id));
  const path = action === 'insert' || action === 'insertReturn'
    ? `/rest/v1/${table}`
    : `/rest/v1/${table}?id=eq.${encodedId}`;
  const method = action === 'delete' ? 'DELETE' : action === 'update' ? 'PATCH' : 'POST';
  const prefer = action === 'insert' || action === 'insertReturn' ? 'return=representation' : 'return=minimal';
  const result = await upstream(path, method, req, method === 'DELETE' ? undefined : (req.body || {}), prefer);
  res.status(result.response.status);
  return result.text ? res.send(result.text) : res.end();
};
