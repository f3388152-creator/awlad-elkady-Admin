const { cors, json, supabase } = require('./_server');

module.exports = async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });

  const phone = String(req.query?.phone || '').trim();
  if (!/^01[0125][0-9]{8}$/.test(phone)) return json(res, 400, { error: 'Invalid phone' });

  try {
    const rows = await supabase(`/rest/v1/orders?customer_phone=eq.${encodeURIComponent(phone)}&select=id,created_at,status,bosta_tracking_number,total&order=created_at.desc&limit=5`);
    return json(res, 200, (rows || []).map(order => ({
      id: order.id,
      created_at: order.created_at,
      status: order.status || 'جديد',
      bosta_tracking_number: order.bosta_tracking_number || null,
      total: Number(order.total || 0)
    })));
  } catch (error) {
    console.error('[bosta-track]', error.message, error.data || '');
    return json(res, error.status || 500, { error: 'Tracking unavailable' });
  }
};
