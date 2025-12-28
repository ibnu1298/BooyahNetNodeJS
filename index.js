const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cron = require("node-cron");
const reminderUserJob = require("./jobs/ReminderUser");

const usersRoutes = require("./routes/userRoutes");
const paymentsRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const roleRoutes = require("./routes/roleRoutes");
const otpRoutes = require("./routes/otpRoutes");

const fs = require("fs");
const path = require("path");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

app.use("/api/users", usersRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/otp", otpRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const initSql = fs
  .readFileSync(path.join(__dirname, "sql", "init.sql"))
  .toString();

db.query(initSql)
  .then(() => console.log("✅ Tables checked/created"))
  .catch((err) => console.error("❌ Init SQL error:", err));

cron.schedule(
  "0 7 * * *",
  () => {
    console.log(
      "🕐 Menjalankan job ReminderUser...",
      new Date().toLocaleTimeString()
    );
    reminderUserJob();
  },
  {
    timezone: "Asia/Jakarta",
  }
);

console.log("🟢 Cron job started.");

// | CRON          | Arti                                |
// | ------------- | ----------------------------------- |
// | `* * * * *`   | setiap menit                        |
// | `*/5 * * * *` | setiap 5 menit                      |
// | `0 * * * *`   | setiap jam (pas menit 0)            |
// | `0 9 * * *`   | setiap hari jam 9 pagi              |
// | `0 0 * * 0`   | setiap minggu (Minggu) jam 12 malam |

// # ┌────────────── second (optional)
//  # │ ┌──────────── minute
//  # │ │ ┌────────── hour
//  # │ │ │ ┌──────── day of month
//  # │ │ │ │ ┌────── month
//  # │ │ │ │ │ ┌──── day of week
//  # │ │ │ │ │ │
//  # │ │ │ │ │ │
//  # * * * * * *
