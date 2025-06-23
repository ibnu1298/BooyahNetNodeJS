require("dotenv").config();
const { Pool } = require("pg");

const isLocal = process.env.DATABASE_URL.includes("localhost");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }), // pakai SSL hanya jika bukan localhost
});

module.exports = pool;
