const express = require("express");
require("dotenv").config();

const usersRoutes = require("./routes/users");
const paymentsRoutes = require("./routes/payments");

const fs = require("fs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use("/users", usersRoutes);
app.use("/payments", paymentsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const initSql = fs.readFileSync(path.join(__dirname, "init.sql")).toString();

db.query(initSql)
  .then(() => console.log("✅ Tables checked/created"))
  .catch((err) => console.error("❌ Init SQL error:", err));
