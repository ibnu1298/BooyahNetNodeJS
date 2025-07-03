const pool = require("../../db");

exports.validateUpdateIsPaid = async (payment_id, is_paid, user_id, otp) => {
  const { rows: users } = await pool.query(
    `SELECT name FROM users WHERE id = $1`,
    [user_id]
  );
  // Cek OTP
  const { rows: otpRows } = await pool.query(
    `SELECT otp_code, expires_at, is_used FROM otp_codes WHERE user_id = $1`,
    [user_id]
  );
  console.log(otpRows);

  if (otpRows.length === 0) {
    return { error: "OTP tidak ditemukan untuk user ini", status: 400 };
  }

  const { otp_code, expires_at, is_used } = otpRows[0];

  // Cek apakah expired
  const now = new Date();
  if (new Date(expires_at) < now || is_used == true) {
    return { error: "OTP sudah kadaluarsa", status: 400 };
  }

  if (otp !== otp_code) {
    return { error: "OTP tidak sesuai", status: 400 };
  }

  if (typeof is_paid !== "boolean") {
    return { error: "is_paid harus berupa boolean", status: 400 };
  }

  const { rows: payment } = await pool.query(
    "SELECT * FROM payments WHERE id = $1",
    [payment_id]
  );
  if (!payment_id || typeof payment_id !== "string" || payment.length === 0) {
    return { error: "payment not found", status: 400 };
  }

  return null; // artinya valid
};

exports.validateUpdatePaidAt = async (payment_id, is_paid, user_id, otp) => {
  const { rows: otpRows } = await pool.query(
    `SELECT otp_code, expires_at, is_used FROM otp_codes WHERE user_id = $1`,
    [user_id]
  );

  if (otpRows.length === 0) {
    return { error: "OTP tidak ditemukan untuk user ini", status: 400 };
  }

  const { otp_code, expires_at, is_used } = otpRows[0];

  // Cek apakah expired
  const now = new Date();
  if (new Date(expires_at) < now || is_used == true) {
    return { error: "OTP sudah kadaluarsa", status: 400 };
  }

  if (otp !== otp_code) {
    return { error: "OTP tidak sesuai", status: 400 };
  }
  if (typeof is_paid !== "boolean") {
    return { error: "OTP tidak sesuai", status: 400 };
  }
  const { rows: payment } = await pool.query(
    "SELECT * FROM payments WHERE id = $1",
    [payment_id]
  );
  if (!payment_id || typeof payment_id !== "string" || payment.length === 0) {
    return { error: "payment not found", status: 400 };
  }

  return null; // artinya valid
};
