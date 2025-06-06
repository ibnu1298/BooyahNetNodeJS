const pool = require("../../db");
exports.validateAuthInput = async (name, email, password, role_id) => {
  console.log(name);
  console.log(email);
  console.log(password);
  console.log(role_id);
  if (!name || !email || !password || !role_id) {
    return "All fields are required";
  }
  const { user } = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  if (user != null) {
    return `${email} already exists`;
  }

  const result = await pool.query("SELECT * FROM roles WHERE id = $1", [
    role_id,
  ]);
  if (result.rows.length === 0) {
    return `Role Not Found`;
  }

  return null;
};
