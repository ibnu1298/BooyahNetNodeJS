const response = require("../utils/response");

module.exports = function checkRole(requiredRole) {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(403).json(response.error("No role assigned to user"));
    }

    if (userRole.toLowerCase() !== requiredRole.toLowerCase()) {
      return res
        .status(403)
        .json(response.error("Access denied: insufficient role"));
    }

    next();
  };
};
