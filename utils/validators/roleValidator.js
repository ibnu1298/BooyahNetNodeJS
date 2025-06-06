const pool = require("../../db");
exports.validateRoleInput = async (name) => {
  if (!name || name.trim() === "") {
    return "Role name is required";
  }
  const { rows } = await pool.query(
    "SELECT * FROM roles WHERE LOWER(name) = LOWER($1)",
    [name]
  );
  if (rows.length > 0) {
    return `Role ${name} already exists`;
  }
  return null;
};
