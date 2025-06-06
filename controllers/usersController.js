const pool = require("../db");
const response = require("../utils/response");
const { validateUserInput } = require("../utils/validators/userValidator");

exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM users WHERE row_status = true"
    );
    res.json(response.success("Users retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email } = req.body;

    const errorMessage = await validateUserInput(name, email);
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

    res
      .status(201)
      .json(response.success("Payment created successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { user_id, name } = req.body;
    const modifiedBy = req.user?.email || "unknown"; // userId dari token
    const role_id = req.user?.role_id;

    // Validasi: name tidak boleh kosong
    if (!name || name.trim() === "") {
      return res.status(400).json(response.error("Name is required"));
    }

    // Cek user target ada
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND row_status = true",
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(response.error("User not found"));
    }

    // Update user
    const updated = await pool.query(
      `UPDATE users
       SET name = $1, modified_at = CURRENT_TIMESTAMP, modified_by = $2
       WHERE id = $3
       RETURNING *`,
      [name, modifiedBy, user_id]
    );

    res
      .status(200)
      .json(response.success("User updated successfully", updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
