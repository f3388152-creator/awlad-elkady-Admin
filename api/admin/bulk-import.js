const { isAdmin } = require('../admin-session');

module.exports = async (req, res) => {
  if (!(await isAdmin(req))) return res.status(403).json({ error: 'Admin role required for bulk import' });
  return res.status(200).json({ ok: true, bulkImport: true });
};
