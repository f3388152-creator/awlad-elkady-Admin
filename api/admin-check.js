const { isAuthenticated, isAdmin } = require('./admin-session');
module.exports = async (req, res) => {
    const authenticated = await isAuthenticated(req);
    const admin = authenticated && await isAdmin(req);
    return res.status(authenticated ? 200 : 401).json({ authenticated, admin });
};
