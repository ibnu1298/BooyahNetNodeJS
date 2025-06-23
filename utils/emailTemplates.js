exports.generateOtpEmailHtml = (otpCode) => {
  return `
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
};
