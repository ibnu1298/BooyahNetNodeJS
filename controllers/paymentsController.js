const pool = require("../db");
const response = require("../utils/response");

exports.getAllPayments = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM payments");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query("SELECT * FROM payments WHERE id = $1", [
      id,
    ]);

    if (rows.length === 0) {
      return res.status(404).json(response.error("payments not found"));
    }
    res.json(response.success("response.error", rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    const createdBy = "system"; // nanti ganti pakai user dari JWT

    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json(response.error("users not found"));
    }
    const result = await pool.query(
      `INSERT INTO payments (user_id, amount, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, amount, createdBy]
    );
    res
      .status(201)
      .json(response.success("Payment created successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("server error"));
  }
};
