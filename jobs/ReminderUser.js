const fs = require("fs");
const path = require("path");
const pool = require("../db");
const beforeBilling = require("./beforeBilling");
const afterBilling = require("./afterBilling");
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
    await beforeBilling(result);
    await afterBilling(result);
    await deleteDataPayment(result);
  } catch (error) {
    console.error("❌ Gagal menjalankan ReminderUser:", error.message);
  }
}

module.exports = reminderUserJob;

async function deleteDataPayment(data) {
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
    console.log(`Deleted rows: ${result.rowCount}`);
  }
}
