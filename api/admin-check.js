const { getSessionUser, isAdmin, isPrimaryAdmin, getEffectivePermissions } = require('../lib/admin-session');

module.exports = async (req, res) => {
  const admin = await isAdmin(req);
  if (!admin) return res.status(401).json({ admin: false });
  const user = await getSessionUser(req);
  const owner = isPrimaryAdmin(user);
  const permissions = owner ? { '*': true } : await getEffectivePermissions(user);
  return res.status(200).json({
    admin: true,
    user_id: user?.id || null,
    owner,
    role: owner ? 'admin' : 'staff',
    display_name: user?.user_metadata?.display_name || user?.email || '',
    permissions
  });
};
