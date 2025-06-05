const pool = require("../db");
const response = require("../utils/response");
const { validateUserInput } = require("../utils/validators/userValidator");

exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM users");
    res.json(response.success("Users retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    const errorMessage = validateUserInput(name, email);
    if (errorMessage) {
      return res.status(400).json(response.error(errorMessage));
    }

    const createdBy = "system"; // nanti ganti pakai user dari JWT

    const result = await pool.query(
      `INSERT INTO users (name, email, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, email, createdBy]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
