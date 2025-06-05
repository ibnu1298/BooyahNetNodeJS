const pool = require("../../db");

exports.validateUserInput = async (name, email) => {
  if (!name || name.trim() === "") {
    return "Name is required";
  }

  if (!email || email.trim() === "") {
    return "Email is required";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return "Invalid email format";
  }

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE email = $1 AND row_status = true",
    [email]
  );
  if (rows.length > 0) {
    return "Email already registered";
  }

  return null; // artinya valid
};
