const jwt = require("jsonwebtoken");

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    // Token usually comes in as "Bearer <token>"
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: "Access Denied: No Token Provided!" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decodedUser) => {
        if (err) {
            return res.status(403).json({ success: false, message: "Invalid or Expired Token!" });
        }

        // Attach the decoded payload (id, role, etc.) to the request object
        req.user = decodedUser;
        next();
    });
}

module.exports = authenticateToken;