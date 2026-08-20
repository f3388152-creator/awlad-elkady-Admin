module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'POST') {
    try {
      const payload = req.body;
      console.log('🚚 [BOSTA WEBHOOK EVENT RECEIVED]:', JSON.stringify(payload, null, 2));

      const trackingNumber = payload?.trackingNumber || payload?.data?.trackingNumber;
      const state = payload?.state || payload?.status || payload?.data?.state;

      return res.status(200).json({
        success: true,
        message: 'Bosta webhook received successfully in Admin',
        received: { trackingNumber, state, timestamp: new Date().toISOString() }
      });
    } catch (error) {
      console.error('Error processing Bosta webhook:', error);
      return res.status(500).json({ success: false, error: error.message });
    }
  }

  return res.status(200).json({
    status: 'online',
    endpoint: '/api/bosta-webhook',
    bostaApiKeyConfigured: Boolean(process.env.BOSTA_API_KEY)
  });
};
