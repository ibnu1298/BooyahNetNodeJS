const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env;
const pool = require("../db");

function generateToken({ id, email, role }) {
  return jwt.sign(
    {
      userId: id,
      email,
      role,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}
module.exports = generateToken;

const generateRandomPhone = async () => {
  const digits = () =>
    Math.floor(100000000000 + Math.random() * 900000000000).toString();
  let phone = digits();

  // Pastikan nomor tidak duplikat
  let exists = await pool.query("SELECT 1 FROM user_details WHERE phone = $1", [
    phone,
  ]);
  while (exists.rows.length > 0) {
    phone = digits();
    exists = await pool.query("SELECT 1 FROM user_details WHERE phone = $1", [
      phone,
    ]);
  }

  return phone;
};
module.exports = generateRandomPhone;
