const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env; // atau `require('../config')` jika disimpan di file config

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
