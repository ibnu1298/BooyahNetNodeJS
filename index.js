const express = require("express");
require("dotenv").config();

const usersRoutes = require("./routes/userRoutes");
const paymentsRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const roleRoutes = require("./routes/roleRoutes");

const fs = require("fs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/api/users", usersRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const initSql = fs
  .readFileSync(path.join(__dirname, "sql", "init.sql"))
  .toString();

db.query(initSql)
  .then(() => console.log("✅ Tables checked/created"))
  .catch((err) => console.error("❌ Init SQL error:", err));
