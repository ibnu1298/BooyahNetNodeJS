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

  var checkPassword = validatePassword(password);
  if (checkPassword !== null) {
    return checkPassword;
  }

  const { rows } = await pool.query(
    "SELECT * FROM users WHERE LOWER(email) = LOWER($1)",
    [email]
  );
  if (rows.length > 0) {
    return "Email already registered";
  }

  return null;
};

function validatePassword(password) {
  let errors = null;

  if (!password) {
    errors = "Password is required.";
  } else {
    if (password.length < 8) {
      errors = "Password must be at least 8 characters.";
    }
    if (!/[A-Z]/.test(password)) {
      errors = "Password must contain at least one uppercase letter.";
    }
    if (!/[a-z]/.test(password)) {
      errors = "Password must contain at least one lowercase letter.";
    }
    if (!/[0-9]/.test(password)) {
      errors = "Password must contain at least one digit.";
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors =
        "Password must contain at least one special character (!@#$%^&*).";
    }
  }

  return errors;
}
