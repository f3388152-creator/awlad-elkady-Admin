const { isAdmin } = require('./admin-session');
module.exports = async (req, res) => {
    const admin = await isAdmin(req);
    return res.status(admin ? 200 : 401).json({ admin });
};
