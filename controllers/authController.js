const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const response = require("../utils/response");
const {
  validateRegistrasi,
  validateRegistrasiWithWhatsApp,
} = require("../utils/validators/authValidator");

const JWT_SECRET = process.env.JWT_SECRET || "rahasia"; // ganti ke .env
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const expireAccessToken = "60s";
const expireRefreshToken = "3m";
exports.register = async (req, res) => {
  try {
    const { name, email, password, role_id } = req.body;
    let finalRoleId = role_id;
    let rolePlot = email === process.env.EMAIL_ADMIN_INIT ? "Admin" : "User";
    if (
      !finalRoleId ||
      typeof finalRoleId !== "string" ||
      finalRoleId.trim() === ""
    ) {
      const roleUser = await pool.query(
        `SELECT id FROM roles
        WHERE LOWER(name) = LOWER($1)`,
        [rolePlot]
      );
      finalRoleId = roleUser.rows[0].id;
    }

    const errorMessage = await validateRegistrasi(
      name,
      email,
      password,
      finalRoleId
    );
    if (errorMessage) {
      return res.status(400).json(response.error(errorMessage));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, password, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role_id`,
      [name, email, hashedPassword, finalRoleId, "system"]
    );

    res
      .status(201)
      .json(response.success("User registered successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.registerWithWhatsapp = async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, email, password, role_id, wa_number, otp, verify_wa_number } =
      req.body;

    await client.query("BEGIN"); // Mulai transaksi

    let finalRoleId = role_id;
    let rolePlot = email === process.env.EMAIL_ADMIN_INIT ? "Admin" : "User";

    if (
      !finalRoleId ||
      typeof finalRoleId !== "string" ||
      finalRoleId.trim() === ""
    ) {
      const roleUser = await client.query(
        `SELECT id FROM roles WHERE LOWER(name) = LOWER($1)`,
        [rolePlot]
      );
      finalRoleId = roleUser.rows[0].id;
    }

    const errorMessage = await validateRegistrasiWithWhatsApp(
      name,
      email,
      password,
      finalRoleId,
      wa_number,
      verify_wa_number,
      otp
    );

    if (errorMessage) {
      await client.query("ROLLBACK");
      return res.status(400).json(response.error(errorMessage));
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await client.query(
      `INSERT INTO users (name, email, password, role_id, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, role_id`,
      [name, email, hashedPassword, finalRoleId, "system"]
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json(response.error("Gagal insert data ke tabel users"));
    }

    const result_details = await client.query(
      `INSERT INTO user_details (user_id, phone, verify_phone, billing_date, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING user_id, verify_phone, phone, billing_date`,
      [
        result.rows[0].id,
        wa_number,
        verify_wa_number,
        new Date(),
        result.rows[0].email,
      ]
    );

    if (result_details.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json(response.error("Gagal insert data ke tabel user_details"));
    }

    await client.query("COMMIT"); // Sukses → commit semua perubahan

    res
      .status(201)
      .json(response.success("User registered successfully", result.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK"); // Jika error, rollback semua
    console.error(err);
    res.status(500).json(response.error("Server error"));
  } finally {
    client.release(); // Pastikan koneksi dilepas
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      `SELECT users.*, roles.name AS role_name
        FROM users
        JOIN roles ON users.role_id = roles.id
        WHERE users.email = $1`,
      [email]
    );
    if (result.rows.length === 0) {
      return res.status(400).json(response.error("Invalid credentials"));
    }

    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json(response.error("Invalid credentials"));
    }

    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role_name,
    };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: "60s",
    });

    // Decode token tanpa verifikasi (hanya untuk melihat isinya)
    const decoded = jwt.decode(token);

    console.log("🧾 Token:", token);
    console.log(
      "🕒 Issued at (iat):",
      new Date(decoded.iat * 1000).toLocaleString()
    );
    console.log(
      "⏰ Expires at (exp):",
      new Date(decoded.exp * 1000).toLocaleString()
    ); // access token cepat expired
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: expireRefreshToken,
    }); // refresh token lebih lama
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );
    console.log(token);

    // console.log("⏱ Token exp:", new Date(token.exp * 1000).toLocaleString());
    res
      .status(200)
      .json(response.success("Login successful", { token, refreshToken }));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
        accessToken: null,
      });
    }

    // Cek token di database
    const { rows } = await pool.query(
      `SELECT * FROM refresh_tokens WHERE token = $1`,
      [refreshToken]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Refresh token tidak dikenal",
        accessToken: null,
      });
    }

    const tokenRecord = rows[0];

    if (new Date(tokenRecord.expires_at) < new Date()) {
      return res.status(403).json({
        success: false,
        message: "Refresh token expired",
        accessToken: null,
      });
    }

    // Verifikasi JWT token
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role,
    };

    const newAccessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: expireAccessToken,
    });

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err);
    return res.status(403).json({
      success: false,
      message: "Invalid or expired token",
      accessToken: null,
    });
  }
};

exports.loginWhatsAppWithOTP = async (req, res) => {
  try {
    const { wa_number, otp } = req.body;

    if (!wa_number || !otp) {
      return res
        .status(400)
        .json(response.error("wa_number dan OTP wajib diisi"));
    }

    // Ambil user berdasarkan wa_number
    const { rows: userRows } = await pool.query(
      `SELECT u.id, u.email, u.password, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_details ud ON ud.user_id = u.id AND ud.row_status = TRUE
       WHERE ud.phone = $1 AND u.row_status = TRUE`,
      [wa_number]
    );

    if (userRows.length === 0) {
      return res.status(404).json(response.error("User tidak ditemukan"));
    }

    const user = userRows[0];

    // Cek OTP di tabel otp_codes
    const { rows: otpRows } = await pool.query(
      `SELECT otp_code, expires_at, is_used FROM otp_codes WHERE user_id = $1`,
      [user.id]
    );

    if (otpRows.length === 0) {
      return res.status(404).json(response.error("OTP tidak ditemukan"));
    }

    const { otp_code, expires_at, is_used } = otpRows[0];

    const now = new Date();
    if (new Date(expires_at) < now || is_used == true) {
      return res.status(400).json(response.error("OTP sudah kadaluarsa"));
    }

    if (otp_code !== otp) {
      return res.status(400).json(response.error("OTP tidak cocok"));
    }
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role_name,
    };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: expireAccessToken,
    }); // access token cepat expired
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: expireRefreshToken,
    }); // refresh token lebih lama
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );
    res
      .status(200)
      .json(response.success("Login successful", { token, refreshToken }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(response.error("Gagal login dengan OTP"));
  }
};

exports.loginEmailWithOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json(response.error("email dan OTP wajib diisi"));
    }

    // Ambil user berdasarkan wa_number
    const { rows: userRows } = await pool.query(
      `SELECT u.id, u.email, u.password, r.name AS role_name
       FROM users u
       JOIN roles r ON u.role_id = r.id
       LEFT JOIN user_details ud ON ud.user_id = u.id AND ud.row_status = TRUE
       WHERE u.email = $1 AND u.row_status = TRUE`,
      [email]
    );

    if (userRows.length === 0) {
      return res.status(404).json(response.error("User tidak ditemukan"));
    }

    const user = userRows[0];

    // Cek OTP di tabel otp_codes
    const { rows: otpRows } = await pool.query(
      `SELECT otp_code, expires_at, is_used FROM otp_codes WHERE user_id = $1`,
      [user.id]
    );

    if (otpRows.length === 0) {
      return res.status(404).json(response.error("OTP tidak ditemukan"));
    }

    const { otp_code, expires_at, is_used } = otpRows[0];

    const now = new Date();
    if (new Date(expires_at) < now || is_used == true) {
      return res.status(400).json(response.error("OTP sudah kadaluarsa"));
    }

    if (otp_code !== otp) {
      return res.status(400).json(response.error("OTP tidak cocok"));
    }
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role_name,
    };
    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: expireAccessToken,
    }); // access token cepat expired
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: expireRefreshToken,
    }); // refresh token lebih lama
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 hari

    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );
    res
      .status(200)
      .json(response.success("Login successful", { token, refreshToken }));
  } catch (err) {
    console.error(err);
    return res.status(500).json(response.error("Gagal login dengan OTP"));
  }
};

exports.logout = async (req, res) => {
  const { refreshToken } = req.body;

  await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [
    refreshToken,
  ]);

  res.status(200).json({ success: true, message: "Logged out" });
};
