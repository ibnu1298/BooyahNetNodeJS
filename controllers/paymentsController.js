const pool = require("../db");
const response = require("../utils/response");
const {
  validateUpdateIsPaid,
  validateUpdatePaidAt,
} = require("../utils/validators/paymentValidator");

exports.getAllPayments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id, user_id, amount, paid_at FROM payments WHERE row_status = true"
    );
    res.json(response.success("Payments retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT id, user_id, amount, paid_at FROM payments WHERE id = $1 AND row_status = true",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json(response.error("payments not found"));
    }
    res.json(response.success("response.error", rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.getPaymentByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { rows } = await pool.query(
      `SELECT payments.id payment_id, user_id,users.name, users.email, amount, paid_at, is_paid
      FROM payments INNER JOIN users ON users.id = payments.user_id 
      WHERE user_id = $1 
      AND users.row_status = true 
      AND payments.row_status = true 
      ORDER BY payments.created_at DESC`,
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(200).json(response.error("Payments not found"));
    }
    res.json(
      response.success(
        `${rows.length} Payments ${rows[0].name} retrieved successfully`,
        rows
      )
    );
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { user_id, amount } = req.body;
    const paid_at = req.body.paid_at ? new Date(req.body.paid_at) : new Date();
    const createdBy = req.user?.email;
    if (!/^[0-9a-f\-]{36}$/.test(user_id)) {
      return res.status(404).json(response.error("users not found"));
    }
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (!user_id || typeof user_id !== "string" || rows.length === 0) {
      return res.status(404).json(response.error("users not found"));
    }
    const result = await pool.query(
      `INSERT INTO payments (user_id, amount, paid_at, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, amount, paid_at, createdBy]
    );
    res
      .status(201)
      .json(response.success("Payment created successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("server error"));
  }
};

exports.UpdateIsPaidPayment = async (req, res) => {
  try {
    const { user_id, payment_id, is_paid } = req.body;
    const modifiedBy = req.user?.email;

    let validasi = await validateUpdateIsPaid(user_id, payment_id, is_paid);
    if (validasi != null) return validasi;
    const result = await pool.query(
      `UPDATE payments SET is_paid = $1, modified_by = $2, modified_at = CURRENT_TIMESTAMP, paid_at = CURRENT_TIMESTAMP
       WHERE id = $3 AND user_id = $4 AND row_status = TRUE
       RETURNING *`,
      [is_paid, modifiedBy, payment_id, user_id]
    );
    res
      .status(201)
      .json(response.success("Payment updated successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("server error"));
  }
};

exports.UpdatePaidAtPayment = async (req, res) => {
  try {
    const { paid_at, payment_id, is_paid } = req.body;
    const modifiedBy = req.user?.email;

    let validasi = await validateUpdatePaidAt(payment_id, is_paid);
    if (validasi != null) return validasi;
    const result = await pool.query(
      `UPDATE payments SET is_paid = $1, modified_by = $2, modified_at = CURRENT_TIMESTAMP, paid_at = $4
       WHERE id = $3 AND row_status = TRUE
       RETURNING *`,
      [is_paid, modifiedBy, payment_id, paid_at]
    );
    res
      .status(201)
      .json(response.success("Payment updated successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("server error"));
  }
};
