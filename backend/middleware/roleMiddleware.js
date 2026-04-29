function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
        // req.user is populated by your authenticateToken middleware
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: "Access Denied: You do not have the required permissions." });
        }
        next();
    };
}

module.exports = authorizeRoles;