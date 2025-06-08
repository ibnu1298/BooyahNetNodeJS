const pool = require("../db");
const response = require("../utils/response");
const nodemailer = require("nodemailer");

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
        `UPDATE otp_codes SET otp_code = $2, expires_at = $3 WHERE user_id = $1`,
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
    const htmlContent = `
        <html>
        <head>
            <style>
            @media (prefers-color-scheme: dark) {
                body {
                background-color: #1e1e1e;
                color: #ffffff;
                }
                .container {
                background-color: #2c2c2c;
                border-color: #444;
                }
                .otp-box {
                background-color: #444;
                color: #fff;
                }
                .footer {
                color: #aaa;
                }
            }

            @media only screen and (max-width: 600px) {
                .container {
                padding: 15px !important;
                }
                .otp-box {
                font-size: 20px !important;
                }
            }
            </style>
        </head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9;">
            <div class="container" style="max-width: 500px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #ffffff;">
            <h2 style="color: #333;">Verifikasi Kode OTP</h2>
            <p>Halo,</p>
            <p>Gunakan kode OTP berikut untuk melanjutkan proses verifikasi akun Anda:</p>
            <div class="otp-box" style="font-size: 24px; font-weight: bold; background-color: #f5f5f5; padding: 12px 20px; text-align: center; border-radius: 6px; margin: 20px 0;">
                ${otpCode}
            </div>
            <p>Kode ini berlaku selama <strong>5 menit</strong> atau sebelum digunakan.</p>
            <p>Jika Anda tidak merasa melakukan permintaan ini, abaikan saja email ini.</p>
            <br>
            <p class="footer" style="color: #888; font-size: 12px;">Terima kasih,<br>Tim BooyahNet</p>
            </div>
        </body>
        </html>
        `;

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

exports.verificationOTP = async (req, res) => {
  const { otp } = req.body;
};

exports.createSendPhoneOTP = async (req, res) => {
  const { phone_number } = req.body;
};
