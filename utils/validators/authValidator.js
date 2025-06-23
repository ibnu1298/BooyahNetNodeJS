const pool = require("../../db");
exports.validateRegistrasi = async (name, email, password, role_id) => {
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

exports.validateRegistrasiWithWhatsApp = async (
  name,
  email,
  password,
  role_id,
  wa_number,
  verify_wa_number,
  otp
) => {
  console.log(wa_number);
  if (
    !name ||
    !email ||
    !password ||
    !role_id ||
    !verify_wa_number ||
    !wa_number
  ) {
    return "All fields are required";
  }
  if (typeof verify_wa_number !== "boolean") {
    return res
      .status(400)
      .json(response.error("verify_wa_number harus berupa boolean"));
  }

  const { rows: user_details } = await pool.query(
    "SELECT * FROM user_details WHERE phone = $1",
    [wa_number]
  );
  if (user_details.length > 0) {
    return `${wa_number} already registered`;
  }

  const { rows: otp_codes } = await pool.query(
    "SELECT * FROM otp_codes WHERE phone = $1 AND otp_code = $2 AND is_used = TRUE",
    [wa_number, otp]
  );

  if (otp_codes.length === 0) {
    return "Kode OTP tidak valid atau belum diverifikasi";
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
  } //else {
  // if (password.length < 8) {
  //   errors = "Password must be at least 8 characters.";
  // }
  // if (!/[A-Z]/.test(password)) {
  //   errors = "Password must contain at least one uppercase letter.";
  // }
  // if (!/[a-z]/.test(password)) {
  //   errors = "Password must contain at least one lowercase letter.";
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors = "Password must contain at least one digit.";
  // }
  // if (!/[!@#$%^&*]/.test(password)) {
  //   errors =
  //     "Password must contain at least one special character (!@#$%^&*).";
  // }
  //}

  return errors;
}
