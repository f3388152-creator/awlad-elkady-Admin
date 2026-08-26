const { cors, json, getBostaLocations } = require('../lib/_server');

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
  try {
    const rows = await getBostaLocations();
    res.setHeader('Cache-Control', 'public, max-age=600, stale-while-revalidate=3600');
    return json(res, 200, rows);
  } catch (error) {
    console.error('[bosta-locations]', error.message, error.data || '');
    return json(res, error.status || 502, { error: 'Bosta locations unavailable' });
  }
};
