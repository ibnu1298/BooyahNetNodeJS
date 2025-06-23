const pool = require("../../db");

exports.validateUpdateIsPaid = async (user_id, payment_id, is_paid, res) => {
  if (typeof is_paid !== "boolean") {
    return res.status(400).json(response.error("is_paid harus berupa boolean"));
  }
  if (!/^[0-9a-f\-]{36}$/.test(user_id)) {
    return res.status(404).json(response.error("users not found"));
  }
  const { rows: user } = await pool.query("SELECT * FROM users WHERE id = $1", [
    user_id,
  ]);
  if (!user_id || typeof user_id !== "string" || user.length === 0) {
    return res.status(404).json(response.error("users not found"));
  }

  const { rows: payment } = await pool.query(
    "SELECT * FROM payments WHERE id = $1",
    [payment_id]
  );
  if (!payment_id || typeof payment_id !== "string" || payment.length === 0) {
    return res.status(404).json(response.error("payment not found"));
  }

  return null; // artinya valid
};

exports.validateUpdatePaidAt = async (payment_id, is_paid, res) => {
  if (typeof is_paid !== "boolean") {
    return res.status(400).json(response.error("is_paid harus berupa boolean"));
  }
  const { rows: payment } = await pool.query(
    "SELECT * FROM payments WHERE id = $1",
    [payment_id]
  );
  if (!payment_id || typeof payment_id !== "string" || payment.length === 0) {
    return res.status(404).json(response.error("payment not found"));
  }

  return null; // artinya valid
};
