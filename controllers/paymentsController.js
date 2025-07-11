const pool = require("../db");
const response = require("../utils/response");
const { createPdfKwitansi } = require("../utils/generatePDF");
const axios = require("axios");
const {
  formatBillingDate,
  capitalizeString,
} = require("../utils/commonFunctions");
const FormData = require("form-data");
const PDFDocument = require("pdfkit");
const {
  validateUpdatePaidAt,
} = require("../utils/validators/paymentValidator");

const baseUrl = process.env.WA_BOT_BASE_URL;
exports.getAllPayments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT * FROM payments WHERE row_status = true"
    );
    res.json(response.success("Payments retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.getPaymentById = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      "SELECT id, user_id, amount, paid_at FROM payments WHERE id = $1 AND row_status = true",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json(response.error("payments not found"));
    }
    res.json(response.success("response.error", rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.getPaymentByUserId = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { rows } = await pool.query(
      `SELECT payments.id payment_id, user_id,users.name, users.email, amount, paid_at, is_paid, billing_date_for
      FROM payments INNER JOIN users ON users.id = payments.user_id 
      WHERE user_id = $1 
      AND users.row_status = true 
      AND payments.row_status = true 
      ORDER BY payments.is_paid, payments.billing_date_for DESC`,
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(200).json(response.error("Payments not found"));
    }
    res.json(
      response.success(
        `${rows.length} Payments ${rows[0].name} retrieved successfully`,
        rows
      )
    );
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};

exports.createPayment = async (req, res) => {
  try {
    const { user_id, amount, billing_date_for } = req.body;
    const paid_at = req.body.paid_at ? new Date(req.body.paid_at) : new Date();
    const createdBy = req.user?.email;
    if (!/^[0-9a-f\-]{36}$/.test(user_id)) {
      return res.status(404).json(response.error("users not found"));
    }
    const { rows } = await pool.query("SELECT * FROM users WHERE id = $1", [
      user_id,
    ]);
    if (!user_id || typeof user_id !== "string" || rows.length === 0) {
      return res.status(404).json(response.error("users not found"));
    }
    const result = await pool.query(
      `INSERT INTO payments (user_id, amount, paid_at, billing_date_for, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user_id, amount, paid_at, billing_date_for, createdBy]
    );
    res
      .status(201)
      .json(response.success("Payment created successfully", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("server error"));
  }
};
exports.UpdatePayment = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { paid_at, payment_id, is_paid, otp } = req.body;
    const modifiedBy = req.user?.email;
    const user_id = req.user?.userId;

    let validasi = await validateUpdatePaidAt(
      payment_id,
      is_paid,
      user_id,
      otp
    );
    if (validasi != null) {
      await client.query("ROLLBACK");
      return res.status(validasi.status).json(response.error(validasi.error));
    }

    const result = await client.query(
      `UPDATE payments 
      SET is_paid = $1, modified_by = $2, modified_at = CURRENT_TIMESTAMP, paid_at = $4
      WHERE id = $3 AND row_status = TRUE
      RETURNING *, 
        to_char(billing_date_for, 'YYYYMMDD') || lpad(payment_number::text, 6, '0') AS formatted_payment_number`,
      [is_paid, modifiedBy, payment_id, paid_at]
    );

    await client.query(
      `UPDATE otp_codes SET is_used = TRUE WHERE otp_code = $1`,
      [otp]
    );
    const payment = result.rows[0];

    if (!payment) {
      await client.query("ROLLBACK");
      return res.status(404).json(response.error("Payment NotFound"));
    }
    if (payment.length == 0) {
      await client.query("ROLLBACK");
      return res.status(404).json(response.error("Payment NotFound"));
    }
    const { rows: user } = await pool.query(
      `SELECT u.name, ud.phone, ud.verify_phone, ud.is_subscribe FROM users u
       LEFT JOIN user_details ud ON ud.user_id = u.id AND ud.row_status =  TRUE
       WHERE u.id=$1 AND u.row_status = TRUE`,
      [payment.user_id]
    );
    if (user.length == 0) {
      await client.query("ROLLBACK");
      return res.status(404).json(response.error("user NotFound"));
    }
    if (user.verify_phone == false) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json(response.error("Whatsapp Pelanggan belum terverifikasi"));
    }
    const paymentFor = payment.billing_date_for
      ? formatBillingDate(payment.billing_date_for, "id-ID", {
          month: "long",
          year: "numeric",
        })
      : "-";

    const nameFile = `Kwitansi_BooyahNet_${paymentFor.replace(" ", "_")}`;
    let buffer = await createPdfKwitansi({
      no: payment.formatted_payment_number,
      receivedFrom: user[0].name,
      amount: payment.amount,
      paymentFor: "WIFI Bulan " + paymentFor,
      date: payment.paid_at,
    });
    buffer = Buffer.from(buffer);

    const form = new FormData();
    form.append("to", user[0].phone);
    form.append(
      "message",
      `Halo ${capitalizeString(
        user[0].name ?? ""
      )}\nberikut kwitansi pembayaran WIFI bulan ${paymentFor}.\nTerima kasih telah melakukan pembayaran.`
    );
    form.append("file", buffer, {
      filename: `${nameFile}.pdf`,
      contentType: "application/pdf",
    });
    if (is_paid && user[0].is_subscribe) {
      try {
        const sendRes = await axios.post(`${baseUrl}/send-file`, form, {
          headers: form.getHeaders(),
        });

        console.log("Kirim WA berhasil:", sendRes.data);
      } catch (err) {
        await client.query("ROLLBACK");
        console.error("Gagal kirim ke WA:", err.response?.data || err.message);
        return res
          .status(500)
          .json(response.error("Gagal mengirim pesan WhatsApp"));
      }
    }

    await client.query("COMMIT");
    res
      .status(201)
      .json(response.success("Payment updated successfully", result.rows[0]));
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json(response.error("server error"));
  } finally {
    client.release();
  }
};

exports.downloadReceipt = async (req, res) => {
  try {
    const { payment_id } = req.params;
    const { rows: payments } = await pool.query(
      `SELECT *,
      to_char(billing_date_for, 'YYYYMMDD') || lpad(payment_number::text, 6, '0') AS formatted_payment_number 
      FROM payments WHERE id = $1 
      AND is_paid = TRUE 
      AND row_status = TRUE`,
      [payment_id]
    );
    if (payments.length === 0) {
      return res.status(404).json(response.error("payments not found"));
    }
    const { rows: users } = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND row_status = TRUE",
      [payments[0].user_id]
    );
    if (users.length === 0) {
      return res.status(404).json(response.error("users not found"));
    }
    const paymentFor = payments[0].billing_date_for
      ? formatBillingDate(payments[0].billing_date_for, "id-ID", {
          month: "long",
          year: "numeric",
        })
      : "-";
    const buffer = await createPdfKwitansi({
      no: payments[0].formatted_payment_number,
      receivedFrom: users[0].name,
      amount: payments[0].amount,
      paymentFor: "WIFI Bulan " + paymentFor,
      date: payments[0].paid_at,
    });
    const nameFile = `Kwitansi_BooyahNet_${paymentFor.replace(" ", "_")}`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=${nameFile}.pdf`);
    res.send(buffer);
  } catch (err) {
    console.error("Gagal generate receipt PDF:", err);
    res.status(500).json({ success: false, message: "Gagal generate PDF" });
  }
};

exports.sendPDF = async (req, res) => {
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
    const phone = user[0].phone;

    let buffer = await createPdfKwitansi({
      name: "John Doe",
      date: "2025-07-01",
      amount: "100.000",
    });
    buffer = Buffer.from(buffer);

    const form = new FormData();
    form.append("to", phone);
    form.append(
      "message",
      `Halo, berikut kwitansi pembayaran Anda bulan ini. Terima kasih telah melakukan pembayaran.`
    );
    form.append("file", buffer, {
      filename: `kwitansi_${Date.now()}.pdf`,
      contentType: "application/pdf",
    });

    const sendRes = await axios.post(`${baseUrl}/send-file`, form, {
      headers: form.getHeaders(),
    });
    console.log("Kirim WA berhasil:", sendRes.data);
    return res
      .status(200)
      .json(response.success(`File berhasil dikirim ke WA : +${phone}`));
  } catch (err) {
    console.error("Gagal kirim File:", err.response?.data || err.message);
    return res.status(500).json(response.error("Gagal mengirim File"));
  }
};
