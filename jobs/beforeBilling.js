const pool = require("../db");
const {
  formatBillingDate,
  formatRupiah,
  formatBillingDateWithDay,
  capitalizeString,
} = require("../utils/commonFunctions");
const firstReminder = process.env.FIRST_REMINDER_BEFORE;
const secondReminder = process.env.SECOND_REMINDER_BEFORE;
const thirdReminder = process.env.THIRD_REMINDER_BEFORE;

async function beforeBilling(data) {
  const reminders = [firstReminder, secondReminder, thirdReminder, 0];

  for (const days of reminders) {
    console.log(`📢 Next Billing H-${days}`);
    await reminder(data, days);
  }
}

module.exports = beforeBilling;

async function reminder(data, days) {
  const filteredNextBilling = data.rows.filter(
    (row) =>
      row.days_until_next_billing == days && Number(row.unpaid_payments) > 0
  );

  const names = filteredNextBilling.map((row) => row.name);
  console.table(names);
  console.log("total filteredNextBilling : " + filteredNextBilling.length);

  for (const user of filteredNextBilling) {
    const message = await getMessageReminder(user.user_id, days);
    console.log("\n");
    console.log(message);
  }
}

async function getMessageReminder(user_id, reminderDays) {
  let text = "";
  const { rows: users } = await pool.query(
    "SELECT * FROM users WHERE id = $1 ",
    [user_id]
  );
  if (!users.length) return text;

  const { rows: payments } = await pool.query(
    "SELECT * FROM payments WHERE user_id = $1 AND is_paid = FALSE AND row_status = TRUE",
    [user_id]
  );
  const { rows: nextPayments } = await pool.query(
    "SELECT * FROM payments WHERE user_id = $1 AND is_paid = FALSE AND billing_date_for >= CURRENT_DATE AND row_status = TRUE",
    [user_id]
  );
  const { rows: latePayments } = await pool.query(
    "SELECT * FROM payments WHERE user_id = $1 AND is_paid = FALSE AND billing_date_for < CURRENT_DATE  AND row_status = TRUE",
    [user_id]
  );

  const totalAmount = payments.reduce(
    (acc, item) => acc + Number(item.amount || 0),
    0
  );

  text = `*Hallo ${capitalizeString(users[0].name)}*\n`;
  if (nextPayments.length) {
    if (reminderDays > 0) {
      text += `Mengingatkan bahwa *${reminderDays} hari lagi* adalah tanggal pembayaran tagihan *WIFI BOOYAH.NET*\npada hari ${formatBillingDateWithDay(
        nextPayments[0].billing_date_for
      )} - Rp ${formatRupiah(nextPayments[0].amount)}`;
    } else {
      text += `Hari ini adalah tanggal pembayaran *WIFI BOOYAH.NET* sebesar Rp ${formatRupiah(
        nextPayments[0].amount
      )}`;
    }
  }
  if (latePayments.length) {
    text += "\n";
    if (nextPayments.length) text += "dan ";
    if (latePayments.length > 1) {
      text += `masih ada ${latePayments.length} tagihan yang belum di bayar\n\nBerikut tagihan nya:\n`;
      latePayments.forEach((item, index) => {
        text += `*• ${formatBillingDate(
          item.billing_date_for
        )} :Rp ${formatRupiah(item.amount)}*\n`;
      });
    } else if (latePayments.length == 1) {
      text += `masih ada ${
        latePayments.length
      } tagihan yang belum di bayar di tanggal ${formatBillingDate(
        latePayments[0].billing_date_for
      )} - Rp ${formatRupiah(latePayments[0].amount)}\n`;
    }
  }
  if (payments.length > 1) {
    text += `\n*Total Tagihan : Rp ${formatRupiah(totalAmount)}*\n`;
  }
  text += `\nApabila ada pertanyaan atau sudah melakukan pembayaran, mohon informasikan kepada kami.\nTerima kasih atas perhatian dan kerjasamanya 🙏`;
  return text;
}
