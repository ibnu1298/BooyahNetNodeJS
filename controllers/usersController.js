const pool = require("../db");
const response = require("../utils/response");
const generateRandomPhone = require("../utils/generate");

exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT         
        users.id user_id,
        users.name,
        users.email,
        users.verify_email,
        ud.phone,
        ud.verify_phone,
        ud.address,
        ud.billing_date,
        roles.name AS role_name
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      LEFT JOIN user_details AS ud 
        ON ud.user_id = users.id AND ud.row_status = TRUE
      WHERE 
        users.row_status = true 
        AND roles.row_status = true`
    );
    res.json(response.success("Users retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
exports.getAllUsersWithPayments = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        users.id,
        users.name,
        users.email,
        roles.name AS role_name,
        COUNT(payments.*) FILTER (WHERE payments.is_paid = false ) AS unpaid_payments,
        COUNT(payments.*) FILTER (WHERE payments.is_paid = true ) AS paid_payments,
        COUNT(payments.*)AS total_payments
      FROM users
      INNER JOIN roles ON roles.id = users.role_id
      LEFT JOIN payments ON payments.user_id = users.id AND payments.row_status = true
      WHERE 
        users.row_status = true 
        AND roles.row_status = true
        
      GROUP BY users.id, users.name, users.email, roles.name ORDER BY unpaid_payments DESC`
    );
    res.json(response.success("Users retrieved successfully", rows));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
      u.id AS user_id, 
      name, 
      email, 
      verify_email,
      ud.phone, 
      verify_phone, 
      address, 
      billing_date 
      FROM users AS u
      LEFT JOIN user_details AS ud 
        ON ud.user_id = u.id AND ud.row_status = TRUE
      WHERE 
      u.id = $1 AND u.row_status = TRUE`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(response.error("User not found"));
    }

    res
      .status(200)
      .json(response.success("Berhasil mengambil data user", result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
exports.updateUser = async (req, res) => {
  const client = await pool.connect();
  try {
    const { user_id, name, email, address, wa_number } = req.body;
    const modifiedBy = req.user?.email || "unknown";

    // Validasi wajib isi
    if (!user_id)
      return res.status(400).json(response.error("User ID wajib diisi"));
    if (!name || name.trim() === "")
      return res.status(400).json(response.error("Nama wajib diisi"));
    if (!email || email.trim() === "")
      return res.status(400).json(response.error("Email wajib diisi"));
    if (!wa_number || wa_number.trim() === "")
      return res.status(400).json(response.error("Nomor WhatsApp wajib diisi"));

    await client.query("BEGIN");

    // Cek user ada
    const userResult = await client.query(
      "SELECT * FROM users WHERE id = $1 AND row_status = true",
      [user_id]
    );
    if (userResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json(response.error("User tidak ditemukan"));
    }

    // Validasi nomor WA sudah terverifikasi dan tidak duplikat
    const [otpRes, duplicatePhoneRes] = await Promise.all([
      client.query(
        `SELECT * FROM otp_codes 
         WHERE phone = $1 AND is_used = TRUE 
         ORDER BY created_at DESC LIMIT 1`,
        [wa_number]
      ),
      client.query(
        `SELECT * FROM user_details 
         WHERE phone = $1 AND user_id != $2`,
        [wa_number, user_id]
      ),
    ]);

    if (otpRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json(response.error("Nomor WhatsApp belum terverifikasi"));
    }

    if (duplicatePhoneRes.rows.length > 0) {
      await client.query("ROLLBACK");
      return res
        .status(409)
        .json(response.error("Nomor WhatsApp sudah digunakan"));
    }

    // Update users
    const updatedUser = await client.query(
      `UPDATE users
       SET name = $1, email = LOWER($2), modified_at = CURRENT_TIMESTAMP, modified_by = $3
       WHERE id = $4
       RETURNING *`,
      [name, email, modifiedBy, user_id]
    );

    // Upsert user_details
    await client.query(
      `INSERT INTO user_details (user_id, phone,verify_phone, address, billing_date, created_by)
       VALUES ($1, $2,TRUE, $3, CURRENT_DATE, $4)
       ON CONFLICT (user_id) DO UPDATE 
       SET phone = $2,verify_phone = TRUE, address = $3, modified_at = CURRENT_TIMESTAMP, modified_by = $4`,
      [user_id, wa_number, address, modifiedBy]
    );

    await client.query("COMMIT");

    return res.status(200).json(
      response.success("User berhasil diperbarui", {
        ...updatedUser.rows[0],
        phone: wa_number,
        address,
      })
    );
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    return res.status(500).json(response.error("Terjadi kesalahan server"));
  } finally {
    client.release();
  }
};
exports.updateUserRole = async (req, res) => {
  try {
    const { user_id, role_id } = req.body;
    const modifiedBy = req.user?.email;

    if (!modifiedBy || modifiedBy.trim() === "") {
      return res.status(403).json(response.error("user not allowed"));
    }
    const { rows: users } = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND row_status = TRUE",
      [user_id]
    );
    if (users.length === 0) {
      return res.status(404).json(response.error("users not found"));
    }
    const { rows: roles } = await pool.query(
      "SELECT * FROM roles WHERE id = $1 AND row_status = TRUE",
      [role_id]
    );
    if (roles.length === 0) {
      return res.status(404).json(response.error("roles not found"));
    }
    // Update user
    const updated = await pool.query(
      `UPDATE users
      SET role_id = $1, modified_at = CURRENT_TIMESTAMP, modified_by = $2
      WHERE id = $3
      RETURNING *`,
      [role_id, modifiedBy, user_id]
    );
    res
      .status(200)
      .json(
        response.success(
          `User role changed to '${roles[0].name}'.`,
          updated.rows[0]
        )
      );
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
exports.updateInsertUserDetail = async (req, res) => {
  try {
    const { user_id, phone, address, billing_date } = req.body;
    const email_user = req.user?.email;
    if (!email_user || email_user.trim() === "") {
      return res.status(403).json(response.error("user not allowed"));
    }
    const { rows: users } = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND row_status = TRUE",
      [user_id]
    );
    if (users.length === 0) {
      return res.status(404).json(response.error("users not found"));
    }
    const { rows: user_detail } = await pool.query(
      "SELECT * FROM user_details WHERE user_id = $1 AND row_status = TRUE",
      [user_id]
    );

    if (user_detail.length === 0) {
      const { rows: user_phone } = await pool.query(
        "SELECT * FROM user_details WHERE phone = $1 AND row_status = TRUE",
        [phone]
      );
      if (user_phone.length > 0) {
        return res
          .status(400)
          .json(response.error("Number Phone Already Registered"));
      }
      const result = await pool.query(
        `INSERT INTO user_details (user_id, phone, address, billing_date, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, user_id, address, billing_date, created_by`,
        [user_id, phone, address, billing_date, email_user]
      );
      res
        .status(201)
        .json(
          response.success("User Detail created successfully", result.rows[0])
        );
    } else {
      if (user_detail.phone !== phone) {
        const updated = await pool.query(
          `UPDATE user_details
          SET phone = $1, modified_at = CURRENT_TIMESTAMP, modified_by = $2, address = $4, billing_date = $5, verify_phone = FALSE
          WHERE user_id = $3
          RETURNING *`,
          [phone, email_user, user_id, address, billing_date]
        );
        res
          .status(200)
          .json(
            response.success(
              "User Detail updated phone successfully",
              updated.rows[0]
            )
          );
      } else {
        const updated = await pool.query(
          `UPDATE user_details
          SET modified_at = CURRENT_TIMESTAMP, modified_by = $2, address = $4, billing_date = $5
          WHERE user_id = $3
          RETURNING *`,
          [phone, email_user, user_id, address, billing_date]
        );
        res
          .status(200)
          .json(
            response.success(
              "User Detail updated successfully",
              updated.rows[0]
            )
          );
      }
    }
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
  }
};
exports.updateBillingDate = async (req, res) => {
  const { user_id, billing_date } = req.body;
  const modifiedBy = req.user?.email || "system";

  if (!user_id || !billing_date) {
    return res.status(400).json({
      success: false,
      message: "user_id dan billing_date wajib diisi",
    });
  }

  try {
    // Cek apakah user_details sudah ada
    const check = await pool.query(
      "SELECT id FROM user_details WHERE user_id = $1",
      [user_id]
    );

    if (check.rows.length === 0) {
      const phone = await generateRandomPhone();

      // Insert baru
      const insertResult = await pool.query(
        `
        INSERT INTO user_details (user_id, phone, billing_date, created_by)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
        `,
        [user_id, phone, billing_date, modifiedBy]
      );

      return res.status(201).json({
        success: true,
        message: "Billing date inserted",
        data: insertResult.rows[0],
      });
    } else {
      // Update billing_date
      const updateResult = await pool.query(
        `
        UPDATE user_details
        SET billing_date = $1,
            modified_at = CURRENT_TIMESTAMP,
            modified_by = $2
        WHERE user_id = $3
        RETURNING *;
        `,
        [billing_date, modifiedBy, user_id]
      );

      return res.status(200).json({
        success: true,
        message: "Billing date updated",
        data: updateResult.rows[0],
      });
    }
  } catch (err) {
    console.error("Error updateBillingDate:", err);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
