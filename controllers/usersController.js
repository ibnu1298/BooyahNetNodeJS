const pool = require("../db");

exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    const createdBy = "system"; // nanti ganti pakai user dari JWT
    const modifiedBy = "system";

    const result = await pool.query(
      `INSERT INTO users (name, email, created_by, modified_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, email, createdBy, modifiedBy]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
