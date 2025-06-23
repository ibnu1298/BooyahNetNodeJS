const pool = require("../db");
const response = require("../utils/response");
const { validateRoleInput } = require("../utils/validators/roleValidator");

exports.createRole = async (req, res) => {
  try {
    const { name, description } = req.body;
    const created_by = req.user?.email || "system"; // bisa pakai req.user kalau sudah pakai JWT

    const errorMessage = await validateRoleInput(name);
    if (errorMessage) {
      return res.status(400).json(response.error(errorMessage));
    }

    const result = await pool.query(
      `INSERT INTO roles (name, description, created_by)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, description || "", created_by]
    );

    res.status(201).json(response.success("Role created", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.getAllRoles = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM roles WHERE row_status = TRUE"
    );
    res
      .status(200)
      .json(response.success("List of roles retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
