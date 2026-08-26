const { getSessionUser, isAdmin, isPrimaryAdmin, getPermissions } = require('./admin-session');

module.exports = async (req, res) => {
  const admin = await isAdmin(req);
  if (!admin) return res.status(401).json({ admin: false });
  const user = await getSessionUser(req);
  const owner = isPrimaryAdmin(user);
  return res.status(200).json({
    admin: true,
    owner,
    role: owner ? 'admin' : 'staff',
    display_name: user?.user_metadata?.display_name || user?.email || '',
    permissions: owner ? { '*': true } : getPermissions(user)
  });
};
