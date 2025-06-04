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
    const result = await pool.query(
      "INSERT INTO payments (user_id, amount) VALUES ($1, $2) RETURNING *",
      [user_id, amount]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
