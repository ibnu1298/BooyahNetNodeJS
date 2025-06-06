const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const response = require("../utils/response");
const { validateAuthInput } = require("../utils/validators/authValidator");

const JWT_SECRET = process.env.JWT_SECRET || "rahasia"; // ganti ke .env

exports.register = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;

    const errorMessage = await validateAuthInput(name);
    if (errorMessage) {
      return res.status(400).json(response.error(errorMessage));
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role_id`,
      [name, email, hashedPassword, role_id, "system"]
    );

    res
      .status(201)
      .json(response.success("User registered successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);
    if (result.rows.length === 0) {
      return res.status(400).json(response.error("Invalid credentials"));
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json(response.error("Invalid credentials"));
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json(response.success("Login successful", { token }));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
