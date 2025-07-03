const pool = require("../db");
const response = require("../utils/response");
const nodemailer = require("nodemailer");
const fetch = require("node-fetch");
const { verify } = require("jsonwebtoken");
const { generateOtpEmailHtml } = require("../utils/emailTemplates");
const { formatBillingDate, formatRupiah } = require("../utils/commonFunctions");
require("dotenv").config();
const { v4: uuidv4 } = require("uuid");
const { List } = require("whatsapp-web.js");
const baseUrl = "http://localhost:3005"; //process.env.WA_BOT_BASE_URL;
exports.createSendEmailOTP = async (req, res) => {
  try {
    const { email } = req.body;

    const { rows: user } = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND row_status = TRUE",
      [email]
    );

    if (user.length === 0) {
      return res.status(404).json(response.error(`${email} not found`));
    }

    const user_id = user[0].id;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    const { rows: otp_codes } = await pool.query(
      "SELECT * FROM otp_codes WHERE user_id = $1",
      [user_id]
    );
    if (otp_codes.length === 0) {
      await pool.query(
        `INSERT INTO otp_codes (user_id, otp_code, expires_at)
       VALUES ($1, $2, $3)`,
        [user_id, otpCode, expiresAt]
      );
    } else {
      await pool.query(
        `UPDATE otp_codes SET otp_code = $2, expires_at = $3, is_used = FALSE  WHERE user_id = $1`,
        [user_id, otpCode, expiresAt]
      );
    }

    // === Konfigurasi transporter email ===
    const transporter = nodemailer.createTransport({
      service: "gmail", // atau sesuaikan: 'smtp.mailtrap.io', 'sendgrid', dll
      auth: {
        user: process.env.EMAIL_USER, // contoh: 'youremail@gmail.com'
        pass: process.env.EMAIL_PASSWORD, // password atau app password
      },
    });
    const htmlContent = generateOtpEmailHtml(otpCode);

    // === Konten email ===
    const mailOptions = {
      from: `"BooyahNet" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Kode OTP Verifikasi Anda",
      html: htmlContent,
    };

    // === Kirim email ===
    await transporter.sendMail(mailOptions);

    return res.status(200).json(response.success("OTP dikirim ke email"));
  } catch (err) {
    console.error("Gagal kirim OTP:", err);
    return res.status(500).json(response.error("Gagal mengirim OTP"));
  }
};
exports.createSendWhatsAppOTP = async (req, res) => {
  try {
    const { wa_number } = req.body;

    const { rows: user } = await pool.query(
      `SELECT u.id, u.Name, u.Email, ud.phone FROM users u
      LEFT JOIN user_details AS ud 
        ON ud.user_id = u.id AND ud.row_status = TRUE
      WHERE ud.phone = $1 
      AND u.row_status = TRUE`,
      [wa_number]
    );

    if (user.length === 0) {
      return res.status(404).json(response.error(`Nomor tidak terdaftar`));
    }

    const user_id = user[0].id;
    const phone = user[0].phone;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    const { rows: otp_codes } = await pool.query(
      "SELECT * FROM otp_codes WHERE user_id = $1",
      [user_id]
    );

    if (otp_codes.length === 0) {
      await pool.query(
        `INSERT INTO otp_codes (user_id, otp_code, expires_at)
         VALUES ($1, $2, $3)`,
        [user_id, otpCode, expiresAt]
      );
    } else {
      await pool.query(
        `UPDATE otp_codes SET otp_code = $2, expires_at = $3, is_used = FALSE WHERE user_id = $1`,
        [user_id, otpCode, expiresAt]
      );
    }

    // === ✅ Kirim OTP ke WhatsApp ===
    // Simpan di .env
    const sendOtpRes = await fetch(`${baseUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: phone,
        message: `Kode OTP kamu adalah: *${otpCode}*\nJangan beritahu siapapun Kode hanya Berlaku hanya 5 Menit`,
      }),
    });

    if (!sendOtpRes.ok) {
      const errMsg = await sendOtpRes.text();
      console.error("Gagal kirim ke WA:", errMsg);
      return res
        .status(500)
        .json(response.error("Gagal mengirim pesan WhatsApp"));
    }

    return res
      .status(200)
      .json(response.success(`OTP berhasil dikirim ke WA : +${phone}`));
  } catch (err) {
    console.error("Gagal kirim OTP:", err);
    return res.status(500).json(response.error("Gagal mengirim OTP"));
  }
};
exports.verificationEmail = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json(response.error("Email dan OTP wajib diisi untuk verifikasi"));
    }

    // Ambil user_id berdasarkan email
    const { rows: userRows } = await pool.query(
      `SELECT id FROM users WHERE email = $1 AND row_status = TRUE`,
      [email]
    );

    if (userRows.length === 0) {
      return res
        .status(400)
        .json(response.error("User dengan email tersebut tidak ditemukan"));
    }

    const user_id = userRows[0].id;

    // Cek OTP
    const { rows: otpRows } = await pool.query(
      `SELECT otp_code, expires_at, is_used FROM otp_codes WHERE user_id = $1`,
      [user_id]
    );

    if (otpRows.length === 0) {
      return res
        .status(400)
        .json(response.error("OTP tidak ditemukan untuk user ini"));
    }

    const { otp_code, expires_at, is_used } = otpRows[0];

    // Cek apakah expired
    const now = new Date();
    if (new Date(expires_at) < now || is_used == true) {
      return res.status(400).json(response.error("OTP sudah kadaluarsa"));
    }

    if (otp !== otp_code) {
      return res.status(400).json(response.error("OTP tidak sesuai"));
    }

    await pool.query(`UPDATE users SET verify_email = TRUE WHERE id = $1`, [
      user_id,
    ]);

    await pool.query(
      `UPDATE otp_codes SET is_used = TRUE WHERE otp_code = $1`,
      [otp_code]
    );

    return res
      .status(200)
      .json(response.success("Email berhasil diverifikasi"));
  } catch (err) {
    console.error("Gagal verifikasi Email:", err);
    return res.status(500).json(response.error("Gagal verifikasi Email"));
  }
};
exports.verificationWhatsApp = async (req, res) => {
  try {
    const { wa_number, otp } = req.body;
    if (!wa_number || !otp) {
      return res
        .status(400)
        .json(response.error("wa_number dan OTP wajib diisi untuk verifikasi"));
    }

    // Ambil user_id berdasarkan email
    const { rows: userRows } = await pool.query(
      `SELECT u.id FROM users u
      LEFT JOIN user_details AS ud ON ud.user_id = u.id AND ud.row_status = TRUE
      WHERE ud.phone = $1 AND u.row_status = TRUE`,
      [wa_number]
    );

    if (userRows.length === 0) {
      return res
        .status(400)
        .json(
          response.error("User dengan nomor whatsapp tersebut tidak ditemukan")
        );
    }

    const user_id = userRows[0].id;

    // Cek OTP
    const { rows: otpRows } = await pool.query(
      `SELECT otp_code, expires_at, is_used FROM otp_codes WHERE user_id = $1`,
      [user_id]
    );

    if (otpRows.length === 0) {
      return res
        .status(400)
        .json(response.error("OTP tidak ditemukan untuk user ini"));
    }

    const { otp_code, expires_at, is_used } = otpRows[0];

    // Cek apakah expired
    const now = new Date();
    if (new Date(expires_at) < now || is_used == true) {
      return res.status(400).json(response.error("OTP sudah kadaluarsa"));
    }

    if (otp !== otp_code) {
      return res.status(400).json(response.error("OTP tidak sesuai"));
    }

    await pool.query(
      `UPDATE user_details SET verify_phone = TRUE WHERE user_id = $1`,
      [user_id]
    );
    await pool.query(
      `UPDATE otp_codes SET is_used = TRUE WHERE otp_code = $1`,
      [otp_code]
    );
    return res
      .status(200)
      .json(response.success("Nomor WhatsApp berhasil diverifikasi"));
  } catch (err) {
    console.error("Gagal verifikasi Nomor WhatsApp:", err);
    return res
      .status(500)
      .json(response.error("Gagal verifikasi Nomor WhatsApp"));
  }
};
exports.sendOtpToUnregisteredWhatsApp = async (req, res) => {
  try {
    let { wa_number } = req.body;

    if (!wa_number) {
      return res.status(400).json(response.error("Nomor WhatsApp wajib diisi"));
    }

    // Hilangkan karakter non-angka
    wa_number = wa_number.replace(/\D/g, "");

    // Check apakah nomor sudah terdaftar
    const existing = await pool.query(
      `SELECT 1 FROM user_details WHERE phone = $1 AND row_status = TRUE`,
      [wa_number]
    );
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json(response.error("Nomor WhatsApp sudah terdaftar"));
    }

    // Generate OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Insert ke otp_codes
    await pool.query(
      `
      INSERT INTO otp_codes (id, phone, otp_code, expires_at, is_used)
      VALUES ($1, $2, $3, $4, FALSE)
      ON CONFLICT (phone) DO UPDATE
      SET otp_code = EXCLUDED.otp_code,
          expires_at = EXCLUDED.expires_at,
          is_used = FALSE
      `,
      [uuidv4(), wa_number, otpCode, expiresAt]
    );

    const sendOtpRes = await fetch(`${baseUrl}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: wa_number,
        message: `Kode OTP kamu adalah: *${otpCode}*\nJangan beritahu siapapun Kode hanya Berlaku hanya 5 Menit`,
      }),
    });

    return res.status(200).json(
      response.success(`OTP berhasil dikirim ke WA : +${wa_number}`, {
        otpSent: true,
      })
    );
  } catch (err) {
    console.error("Gagal kirim OTP:", err);
    return res.status(500).json(response.error("Gagal mengirim OTP"));
  }
};
exports.sendOtpToUnregisteredEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json(response.error("Email harus diisi"));
    }

    // Cek apakah email sudah pernah dipakai daftar
    const { rows: users } = await pool.query(
      "SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND row_status = TRUE",
      [email]
    );

    if (users.length > 0) {
      return res.status(409).json(response.error(`${email} sudah terdaftar`));
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 menit

    // Cek apakah sudah ada otp sebelumnya
    const { rows: existing } = await pool.query(
      `SELECT * FROM otp_codes WHERE email = $1`,
      [email]
    );

    if (existing.length === 0) {
      await pool.query(
        `INSERT INTO otp_codes (email, otp_code, expires_at)
         VALUES ($1, $2, $3)`,
        [email, otpCode, expiresAt]
      );
    } else {
      await pool.query(
        `UPDATE otp_codes 
         SET otp_code = $2, expires_at = $3, is_used = FALSE 
         WHERE email = $1`,
        [email, otpCode, expiresAt]
      );
    }

    // === Transporter email ===
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });

    const htmlContent = generateOtpEmailHtml(otpCode);

    const mailOptions = {
      from: `"BooyahNet" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Kode OTP Verifikasi Anda",
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    return res
      .status(200)
      .json(response.success(`OTP berhasil dikirim ke ${email}`));
  } catch (err) {
    console.error("Gagal kirim OTP email unregistered:", err);
    return res.status(500).json(response.error("Gagal mengirim OTP"));
  }
};
exports.verifyOTPUnregistered = async (req, res) => {
  try {
    const { otp, wa_number, email } = req.body;

    if (!otp || (!wa_number && !email)) {
      return res
        .status(400)
        .json(response.error("OTP dan (wa_number atau email) harus diisi"));
    }

    // 1. Cek apakah email sudah ada di tabel users
    if (email) {
      const { rows: existingEmail } = await pool.query(
        `SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND row_status = TRUE LIMIT 1`,
        [email]
      );
      if (existingEmail.length > 0) {
        return res.status(409).json(response.error("Email sudah terdaftar"));
      }
    }

    // 2. Cek apakah phone sudah ada di user_details
    if (wa_number) {
      const { rows: existingPhone } = await pool.query(
        `SELECT 1 FROM user_details WHERE phone = $1 AND row_status = TRUE LIMIT 1`,
        [wa_number]
      );
      if (existingPhone.length > 0) {
        return res
          .status(409)
          .json(response.error("Nomor WhatsApp sudah terdaftar"));
      }
    }

    // 3. Ambil data OTP yang belum kadaluarsa dan belum dipakai
    const queryBase = `
      SELECT * FROM otp_codes 
      WHERE otp_code = $1
        AND is_used = FALSE
        AND expires_at > NOW()
        AND ${wa_number ? "phone = $2" : "email = $2"}
      LIMIT 1
    `;

    const values = [otp, wa_number || email];
    const { rows } = await pool.query(queryBase, values);

    if (rows.length === 0) {
      return res
        .status(400)
        .json(response.error("OTP tidak valid atau sudah kadaluarsa"));
    }

    const otpData = rows[0];

    // 4. Tandai OTP sebagai sudah digunakan
    await pool.query(`UPDATE otp_codes SET is_used = TRUE WHERE id = $1`, [
      otpData.id,
    ]);

    return res.status(200).json(
      response.success("OTP valid, silakan lanjutkan pendaftaran", {
        verified: true,
      })
    );
  } catch (err) {
    console.error("Gagal verifikasi OTP:", err);
    return res.status(500).json(response.error("Server error"));
  }
};
exports.sendMessageList = async (req, res) => {
  const { wa_number, user_id } = req.body;

  const text = await getMessageReminder(user_id);
  console.log(text);

  // kirim ke service /send
  const sendRes = await fetch(`${baseUrl}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to: `${wa_number}`,
      message: text,
    }),
  });

  if (!sendRes.ok) {
    const errMsg = await sendRes.text();
    console.error("Gagal kirim ke WA:", errMsg);
    return res
      .status(500)
      .json(response.error("Gagal mengirim pesan WhatsApp"));
  }

  return res
    .status(200)
    .json(response.success(`List berhasil dikirim ke WA: ${wa_number}`));
};
