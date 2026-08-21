window.AdminSupabaseAPI = (() => {
  function buildUrl(baseUrl, path, query = {}) {
    const normalizedBase = String(baseUrl || '').replace(/\/$/, '');
    const normalizedPath = String(path || '').startsWith('/') ? path : `/${path}`;
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

  function createClient({ supabaseUrl, supabaseKey, storageBucket = 'admin-media' }) {
    if (!supabaseUrl || !supabaseKey) {
      return null;
    }

    async function request(path, { method = 'GET', query = {}, body, headers = {} } = {}) {
      const response = await fetch(buildUrl(supabaseUrl, path, query), {
        method,
        headers: {
          ...authHeaders(supabaseKey),
          'Content-Type': 'application/json',
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

    async function select(table, { select = '*', filters = [], order, limit } = {}) {
      const query = { select };
      if (order) query.order = order;
      if (limit !== undefined) query.limit = String(limit);
      filters.forEach((filter) => {
        const [key, ...rest] = String(filter).split('=');
        if (!key || rest.length === 0) return;
        query[key] = rest.join('=');
      });
      return request(`/rest/v1/${table}`, { query });
    }

    async function insert(table, rows, { select = '*' } = {}) {
      return request(`/rest/v1/${table}`, {
        method: 'POST',
        query: { select },
        body: Array.isArray(rows) ? rows : [rows],
        headers: {
          Prefer: 'return=representation'
        }
      });
    }

    async function update(table, values, filters = []) {
      const query = {};
      filters.forEach((filter) => {
        const [key, ...rest] = String(filter).split('=');
        if (!key || rest.length === 0) return;
        query[key] = rest.join('=');
      });
      return request(`/rest/v1/${table}`, {
        method: 'PATCH',
        query,
        body: values,
        headers: {
          Prefer: 'return=representation'
        }
      });
    }

    async function remove(table, filters = []) {
      const query = {};
      filters.forEach((filter) => {
        const [key, ...rest] = String(filter).split('=');
        if (!key || rest.length === 0) return;
        query[key] = rest.join('=');
      });
      return request(`/rest/v1/${table}`, {
        method: 'DELETE',
        query
      });
    }

    async function uploadFile(file, folder = 'products') {
      const safeName = `${Date.now()}-${String(file.name || 'file').replace(/[^\w.-]+/g, '_')}`;
      const path = `${folder}/${safeName}`;
      const response = await fetch(buildUrl(supabaseUrl, `/storage/v1/object/${storageBucket}/${path}`), {
        method: 'POST',
        headers: {
          ...authHeaders(supabaseKey),
          'Content-Type': file.type || 'application/octet-stream',
          'x-upsert': 'true'
        },
        body: file
      });

      const text = await response.text();
      if (!response.ok) {
        throw new Error(text || `File upload failed with ${response.status}`);
      }

      return {
        path,
        publicUrl: getPublicUrl(path)
      };
    }

    function getPublicUrl(path) {
      return `${String(supabaseUrl).replace(/\/$/, '')}/storage/v1/object/public/${storageBucket}/${encodeURI(path)}`;
    }

    async function getSetting(field = null) {
      const rows = await select('site_settings', { limit: 1 });
      const row = rows && rows[0] ? rows[0] : null;
      if (!field) return row;
      return row ? row[field] ?? null : null;
    }

    async function setSetting(values) {
      const payload = values && typeof values === 'object' ? values : {};
      const existing = await getSetting();

      if (existing && existing.id) {
        return update('site_settings', payload, [`id=eq.${existing.id}`]);
      }

      return insert('site_settings', payload);
    }

    return {
      select,
      insert,
      update,
      remove,
      uploadFile,
      getPublicUrl,
      getSetting,
      setSetting,
      rawRequest: request,
      supabaseUrl,
      supabaseKey
    };
  }

  return { createClient };
})();
