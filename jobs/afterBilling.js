const { table } = require("pdfkit");
const pool = require("../db");
const {
  formatBillingDate,
  formatRupiah,
  formatBillingDateWithDay,
  capitalizeString,
} = require("../utils/commonFunctions");
const firstReminder = process.env.FIRST_REMINDER_AFTER;
const secondReminder = process.env.SECOND_REMINDER_AFTER;
const thirdReminder = process.env.THIRD_REMINDER_AFTER;
const baseUrl = process.env.WA_BOT_BASE_URL;
async function afterBilling(data) {
  const reminders = [firstReminder, secondReminder, thirdReminder];
  console.log("Menjalankan Job After Billing...");
  for (const days of reminders) {
    console.log(`📢 Reminder H+${days}`);
    await reminder(data, days);
  }
  console.log("Job After Billing Selesai ✅");
}

module.exports = afterBilling;

async function reminder(data, days) {
  const filteredOverdueBilling = data.rows.filter(
    (row) => row.days_overdue == days && Number(row.unpaid_payments) > 0,
  );
  const names = filteredOverdueBilling.map((row) => row.name || "-").join(", ");
  console.log(`${filteredOverdueBilling.length} User - (${names})`);

  for (const user of filteredOverdueBilling) {
    const message = await getMessageReminder(user.user_id, days);
    try {
      // await fetch(`${baseUrl}/send`, {
      //   method: "POST",
      //   headers: {
      //     "Content-Type": "application/json",
      //   },
      //   body: JSON.stringify({
      //     to: user.phone,
      //     message: message,
      //   }),
      // });
      console.log(`Successfully Send Reminder to ${user.name}`);
    } catch (error) {
      console.log(`Failed Send Reminder to ${user.name}, Error : ${error}`);
    }
  }
}

async function getMessageReminder(user_id, reminderDays) {
  let text = "";
  const { rows: users } = await pool.query(
    "SELECT * FROM users WHERE id = $1 ",
    [user_id],
  );
  if (!users.length) return text;

  const { rows: payments } = await pool.query(
    "SELECT id, user_id, billing_date_for, amount, is_paid FROM payments WHERE user_id = $1 AND is_paid = FALSE AND row_status = TRUE ORDER BY billing_date_for DESC",
    [user_id],
  );
  const { rows: paymentsIsPaid } = await pool.query(
    "SELECT id, user_id, billing_date_for, amount, is_paid FROM payments WHERE user_id = $1 AND is_paid = TRUE AND row_status = TRUE ORDER BY billing_date_for DESC",
    [user_id],
  );

  const { rows: latePayments } = await pool.query(
    `SELECT 
      id, 
      user_id, 
      billing_date_for, 
      amount, 
      is_paid,
      (CURRENT_DATE - billing_date_for) AS overdue_days
    FROM payments 
    WHERE 
      user_id = $1 
      AND is_paid = FALSE 
      AND billing_date_for < CURRENT_DATE
      AND row_status = TRUE`,
    [user_id],
  );
  const [mildlyLatePayments, veryLatePayments] = [
    latePayments.filter(
      (p) => p.overdue_days > 0 && p.overdue_days <= thirdReminder,
    ),
    latePayments.filter((p) => p.overdue_days > thirdReminder),
  ];

  const totalAmount = payments.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0,
  );

  text = `*Hallo ${capitalizeString(users[0].name)}*\n`;
  if (mildlyLatePayments.length) {
    if (reminderDays > 0) {
      text += `Mengingatkan bahwa tanggal pembayaran tagihan *WIFI BooyahNet* terlambat *${reminderDays} hari* \npembayaran untuk hari ${formatBillingDateWithDay(
        mildlyLatePayments[0].billing_date_for,
      )} - Rp ${formatRupiah(mildlyLatePayments[0].amount)}\n`;
    }
    if (veryLatePayments.length > 0) {
      text += "dan ";
    }
  } else {
    text += `Terimakasih telah melakukan pembayaran untuk bulan *${formatBillingDate(
      paymentsIsPaid[0].billing_date_for,
      "id-ID",
      {
        month: "long", // bisa 'short' untuk Jun
        year: "numeric",
      },
    )}*\n`;
    if (veryLatePayments.length > 0) {
      text += "tapi ";
    }
  }
  if (veryLatePayments.length) {
    if (mildlyLatePayments.length && veryLatePayments.length > 1) text += "";

    text += `masih ada ${veryLatePayments.length} tagihan yang belum di bayar\n\nBerikut tagihan nya:\n`;
    veryLatePayments.forEach((item, index) => {
      text += `• ${formatBillingDate(item.billing_date_for)} :Rp ${formatRupiah(
        item.amount,
      )}\n`;
    });
  } else if (mildlyLatePayments.length && veryLatePayments.length == 1) {
    text += `masih ada ${
      veryLatePayments.length
    } tagihan yang belum di bayar di tanggal ${formatBillingDate(
      veryLatePayments[0].billing_date_for,
    )} - Rp ${formatRupiah(veryLatePayments[0].amount)}\n`;
  }
  if (payments.length > 1) {
    text += `\n*Total Tagihan : Rp ${formatRupiah(totalAmount)}*\n`;
  }
  text += `\nApabila ada pertanyaan atau sudah melakukan pembayaran, mohon informasikan kepada kami.\nTerima kasih atas perhatian dan kerjasamanya 🙏\ncek pembayaran disini:\nhttps://booyahnet.vercel.app`;
  return text;
}
