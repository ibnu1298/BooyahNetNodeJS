const pool = require("../../db");
exports.validateAuthInput = async (name, email, password, role_id) => {
  if (!name || !email || !password || !role_id) {
    return res.status(400).json(response.error("All fields are required"));
  }
  const { user } = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  if (user.length > 0) {
    return `${email} already exists`;
  }

  const { role } = await pool.query("SELECT * FROM roles WHERE role_id = $1", [
    role_id,
  ]);
  if (role.length === 0) {
    return `Role Not Found`;
  }

  return null;
};
