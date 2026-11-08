require("dotenv").config();
const db = require("./db");

async function testConnection() {
  try {
    const result = await db.query("SELECT NOW()");

    console.log("✅ PostgreSQL Connected!");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("❌ Connection Error:", error);
  } finally {
    await db.end();
  }
}

testConnection();
