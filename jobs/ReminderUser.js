const fs = require("fs");
const path = require("path");
const pool = require("../db");
const beforeBilling = require("./beforeBilling");
const afterBilling = require("./afterBilling");
const { createPdfKwitansi } = require("../utils/generatePDF");
const axios = require("axios");
const FormData = require("form-data");
const {
  formatBillingDate,
  capitalizeString,
} = require("../utils/commonFunctions");
const { Pool } = require("pg");
const firstReminder = process.env.FIRST_REMINDER_BEFORE;
const formatToIndo = (date) => {
  return new Date(date).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};
async function reminderUserJob() {
  try {
    const sqlPath = path.join(__dirname, "../sql/ReportBillingUsers.sql");
    const query = fs.readFileSync(sqlPath, "utf-8");

    let result = await pool.query(query);

    const filteredNextBilling = result.rows.filter(
      (row) => row.days_until_next_billing <= firstReminder,
    );

    for (const user of filteredNextBilling) {
      const { user_id } = user;

      // cek apakah sudah ada, kalau belum baru insert
      const check = await pool.query(
        `SELECT p.id FROM payments p 
        JOIN user_details ud ON ud.user_id = p.user_id 
        WHERE p.user_id = $1 
          AND p.billing_date_for = (
            CASE 
              WHEN CURRENT_DATE <= (
                date_trunc('month', CURRENT_DATE)
                + (LEAST(
                    EXTRACT(DAY FROM ud.billing_date)::int,
                    EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day'))
                  ) - 1
                ) * interval '1 day'
              )::date
              THEN (
                date_trunc('month', CURRENT_DATE)
                + (LEAST(
                    EXTRACT(DAY FROM ud.billing_date)::int,
                    EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day'))
                  ) - 1
                ) * interval '1 day'
              )::date
              ELSE (
                date_trunc('month', CURRENT_DATE)
                + interval '1 month'
                + (LEAST(
                    EXTRACT(DAY FROM ud.billing_date)::int,
                    EXTRACT(DAY FROM (date_trunc('month', CURRENT_DATE) + interval '2 month - 1 day'))
                  ) - 1
                ) * interval '1 day'
              )::date
            END
          )
          AND p.row_status = TRUE
        `,
        [user_id],
      );

      if (check.rows.length === 0) {
        await pool.query(
          `INSERT INTO payments (user_id, billing_date_for, is_paid,amount, row_status,created_by, created_at)
          SELECT 
            $1,
            CASE 
              WHEN CURRENT_DATE <= (
                date_trunc('month', CURRENT_DATE)
                + (
                    LEAST(
                      EXTRACT(DAY FROM ud.billing_date)::int,
                      EXTRACT(
                        DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')
                      )
                    ) - 1
                  ) * interval '1 day'
              )::date
              THEN (
                date_trunc('month', CURRENT_DATE)
                + (
                    LEAST(
                      EXTRACT(DAY FROM ud.billing_date)::int,
                      EXTRACT(
                        DAY FROM (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')
                      )
                    ) - 1
                  ) * interval '1 day'
              )::date
              ELSE (
                date_trunc('month', CURRENT_DATE)
                + interval '1 month'
                + (
                    LEAST(
                      EXTRACT(DAY FROM ud.billing_date)::int,
                      EXTRACT(
                        DAY FROM (date_trunc('month', CURRENT_DATE) + interval '2 month - 1 day')
                      )
                    ) - 1
                  ) * interval '1 day'
              )::date
            END,
            FALSE,
            ud.package,
            TRUE,
            'Reminder Jobs',
            NOW()
          FROM user_details ud 
          WHERE ud.user_id = $1 AND ud.row_status = TRUE
      `,
          [user_id],
        );
        console.log(`✅ Insert payment untuk user ${user_id}`);
      }
    }
    result = await pool.query(query);
    console.table(
      result.rows.map((row) => ({
        ...row,
        billing_date: formatToIndo(row.billing_date),
        next_billing_date: formatToIndo(row.next_billing_date),
        unpaid_payments: Number(row.unpaid_payments),
      })),
    );
    await sendReceipt();
    await beforeBilling(result);
    await afterBilling(result);
    await cleaningData(result);
  } catch (error) {
    console.error("❌ Gagal menjalankan ReminderUser:", error.message);
  }
}

module.exports = reminderUserJob;

async function cleaningData(data) {
  for (const user of data.rows) {
    const query = `
      WITH unpaid AS (
        SELECT id
        FROM payments
        WHERE user_id = $1
          AND is_paid = false
      ),
      paid AS (
        SELECT 
          id,
          ROW_NUMBER() OVER (ORDER BY billing_date_for DESC) AS rn,
          (SELECT COUNT(*) FROM unpaid) AS unpaid_count
        FROM payments
        WHERE user_id = $1
          AND is_paid = true
      )
      DELETE FROM payments p
      USING paid
      WHERE p.id = paid.id
        AND paid.rn > GREATEST(0, 5 - paid.unpaid_count);
    `;

    const result = await pool.query(query, [user.user_id]);
  }
  // Hapus OTP expired
  const otpResult = await pool.query(`
    DELETE FROM otp_codes
    WHERE expires_at < NOW();
  `);

  // Hapus refresh token expired
  const refreshResult = await pool.query(`
    DELETE FROM refresh_tokens
    WHERE expires_at < NOW();
  `);
}

async function sendReceipt() {
  const client = await pool.connect();

  try {
    console.log("Ambil data to sendReceipt");

    // Ambil payment yang belum dikirim
    const query = `
      SELECT
        p.id,
        p.user_id,
        p.amount,
        p.paid_at,
        p.billing_date_for,
        p.payment_number
      FROM payments p
      WHERE p.is_paid = TRUE
        AND p.is_send_receipt = FALSE
        AND p.row_status = TRUE
      ORDER BY p.paid_at ASC
      LIMIT 50
      FOR UPDATE SKIP LOCKED;
    `;

    await client.query("BEGIN");

    const result = await client.query(query);

    await client.query("COMMIT");

    console.log(`Total payment ditemukan: ${result.rowCount}`);

    for (const payment of result.rows) {
      try {
        const paymentFor = payment.billing_date_for
          ? formatBillingDate(payment.billing_date_for, "id-ID", {
              month: "long",
              year: "numeric",
            })
          : "-";

        // Ambil data user
        const { rows: users } = await pool.query(
          `
          SELECT
            u.name,
            ud.phone,
            ud.verify_phone,
            ud.is_subscribe
          FROM users u
          LEFT JOIN user_details ud
            ON ud.user_id = u.id
            AND ud.row_status = TRUE
          WHERE u.id = $1
            AND u.row_status = TRUE
          `,
          [payment.user_id],
        );

        const user = users[0];

        if (!user) {
          console.log(`User tidak ditemukan: ${payment.user_id}`);
          continue;
        }

        // Validasi nomor WhatsApp
        if (!user.phone || !user.verify_phone || !user.is_subscribe) {
          console.log(
            `Skip receipt #${payment.payment_number}: WhatsApp tidak memenuhi syarat`,
          );
          continue;
        }

        const nameFile = `Kwitansi_BooyahNet_${paymentFor.replace(/\s+/g, "_")}`;

        // Generate PDF
        let buffer = await createPdfKwitansi({
          no: payment.payment_number,
          receivedFrom: user.name,
          amount: payment.amount,
          paymentFor: `WIFI Bulan ${paymentFor}`,
          date: payment.paid_at,
        });

        buffer = Buffer.from(buffer);

        // Prepare FormData
        const form = new FormData();

        form.append("to", user.phone);

        form.append(
          "message",
          `Halo ${capitalizeString(user.name ?? "")}
berikut kwitansi pembayaran WIFI bulan ${paymentFor}.
Terima kasih telah melakukan pembayaran.`,
        );

        form.append("file", buffer, {
          filename: `${nameFile}.pdf`,
          contentType: "application/pdf",
        });
        const baseUrl = process.env.WA_BOT_BASE_URL;
        // Kirim WhatsApp
        const sendRes = await axios.post(`${baseUrl}/send-file`, form, {
          headers: form.getHeaders(),
          timeout: 30000,
        });
        console.log("sendres:");

        console.log(sendRes.data);
        // Pastikan API menyatakan pengiriman berhasil.
        // Sesuaikan pengecekan ini dengan response API WhatsApp lo.
        if (!sendRes.data || sendRes.data.success !== true) {
          throw new Error(
            sendRes.data?.message || "WhatsApp gagal mengirim file",
          );
        }

        // Update status setelah berhasil dikirim
        await pool.query(
          `
          UPDATE payments
          SET
            is_send_receipt = TRUE,
            modified_at = CURRENT_TIMESTAMP,
            modified_by = 'cron_job'
          WHERE id = $1
            AND is_send_receipt = FALSE;
          `,
          [payment.id],
        );

        console.log(
          `Receipt berhasil dikirim: Payment #${payment.payment_number}`,
        );
      } catch (error) {
        console.error(
          `Failed sending receipt #${payment.payment_number}:`,
          error.response?.data || error.message,
        );

        // Lanjut ke payment berikutnya
      }
    }
  } catch (error) {
    console.error("Send receipt error:", error);
  } finally {
    client.release();
  }
}
