const crypto = require('crypto');
const { token, isAdmin, SUPABASE_URL, SUPABASE_ANON_KEY } = require('./admin-session');

const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_BYTES = 5 * 1024 * 1024;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!(await isAdmin(req))) return res.status(401).json({ error: 'Admin session required' });
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return res.status(503).json({ error: 'Storage is not configured' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const mimeType = String(body.mimeType || '');
    const contentBase64 = String(body.contentBase64 || '').replace(/^data:[^;]+;base64,/, '');
    if (!ALLOWED_TYPES.has(mimeType) || !contentBase64) return res.status(400).json({ error: 'Invalid image payload' });

    const buffer = Buffer.from(contentBase64, 'base64');
    if (!buffer.length || buffer.length > MAX_BYTES) return res.status(413).json({ error: 'Image is too large' });

    const bucket = typeof req.query?.bucket === 'string' && /^[a-z0-9_-]+$/.test(req.query.bucket) ? req.query.bucket : 'public-assets';
    if (bucket !== 'public-assets') return res.status(400).json({ error: 'Unsupported bucket' });
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    const fileName = `${Date.now()}_${crypto.randomBytes(5).toString('hex')}.${ext}`;
    const upstream = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${fileName}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token(req)}`,
        'Content-Type': mimeType,
        'x-upsert': 'false'
      },
      body: buffer
    });
    const text = await upstream.text();
    if (!upstream.ok) return res.status(upstream.status).send(text || 'Storage upload failed');
    return res.status(200).json({ url: `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${fileName}` });
  } catch (_) {
    return res.status(400).json({ error: 'Invalid image payload' });
  }
};
