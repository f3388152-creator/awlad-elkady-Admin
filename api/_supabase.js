const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
};

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!url || !anonKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }

  return { url, anonKey, serviceRoleKey };
}

function buildUrl(baseUrl, path, query = {}) {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${normalizedBase}${normalizedPath}`);

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    url.searchParams.set(key, String(value));
  });

  return url.toString();
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  };
}

async function supabaseRequest(path, { method = 'GET', query = {}, body, useServiceRole = false, headers = {} } = {}) {
  const { url, anonKey, serviceRoleKey } = getSupabaseConfig();
  const key = useServiceRole && serviceRoleKey ? serviceRoleKey : anonKey;

  const response = await fetch(buildUrl(url, path, query), {
    method,
    headers: {
      ...authHeaders(key),
      ...DEFAULT_HEADERS,
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = new Error(
      (payload && payload.message) ||
      (payload && payload.error) ||
      `Supabase request failed with ${response.status}`
    );
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function selectRows(table, options = {}) {
  const {
    select = '*',
    filters = [],
    order,
    limit,
    offset,
    useServiceRole = false
  } = options;

  const query = { select };
  if (order) query.order = order;
  if (limit !== undefined) query.limit = String(limit);
  if (offset !== undefined) query.offset = String(offset);

  filters.forEach((filter) => {
    const [key, ...rest] = filter.split('=');
    if (!key || rest.length === 0) return;
    query[key] = rest.join('=');
  });

  return supabaseRequest(`/rest/v1/${table}`, {
    query,
    useServiceRole
  });
}

async function insertRows(table, rows, options = {}) {
  const body = Array.isArray(rows) ? rows : [rows];
  return supabaseRequest(`/rest/v1/${table}`, {
    method: 'POST',
    query: { select: options.select || '*' },
    body,
    useServiceRole: options.useServiceRole || false,
    headers: {
      Prefer: 'return=representation'
    }
  });
}

async function updateRows(table, values, filters = [], options = {}) {
  const query = {};
  filters.forEach((filter) => {
    const [key, ...rest] = filter.split('=');
    if (!key || rest.length === 0) return;
    query[key] = rest.join('=');
  });

  return supabaseRequest(`/rest/v1/${table}`, {
    method: 'PATCH',
    query,
    body: values,
    useServiceRole: options.useServiceRole || false,
    headers: {
      Prefer: 'return=representation'
    }
  });
}

async function deleteRows(table, filters = [], options = {}) {
  const query = {};
  filters.forEach((filter) => {
    const [key, ...rest] = filter.split('=');
    if (!key || rest.length === 0) return;
    query[key] = rest.join('=');
  });

  return supabaseRequest(`/rest/v1/${table}`, {
    method: 'DELETE',
    query,
    useServiceRole: options.useServiceRole || false
  });
}

module.exports = {
  getSupabaseConfig,
  supabaseRequest,
  selectRows,
  insertRows,
  updateRows,
  deleteRows
};
