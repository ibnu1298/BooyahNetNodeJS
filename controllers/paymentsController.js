const pool = require("../db");

exports.getAllPayments = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM payments");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { user_id, amount } = req.body;

    const createdBy = "system"; // nanti ganti pakai user dari JWT
    const modifiedBy = "system";

    const result = await pool.query(
      `INSERT INTO payments (user_id, amount, created_by, modified_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [user_id, amount, createdBy, modifiedBy]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
