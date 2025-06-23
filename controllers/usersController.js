const pool = require("../db");
const response = require("../utils/response");

exports.getAllUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT 
        users.id,
        users.name,
        users.email,
        users.verify_email,
        ud.phone,
        ud.verify_phone,
        ud.address,
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
  try {
    const { user_id, name } = req.body;
    const modifiedBy = req.user?.email || "unknown"; // userId dari token

    // Validasi: name tidak boleh kosong
    if (!name || name.trim() === "") {
      return res.status(400).json(response.error("Name is required"));
    }

    // Cek user target ada
    const result = await pool.query(
      "SELECT * FROM users WHERE id = $1 AND row_status = true",
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json(response.error("User not found"));
    }

    // Update user
    const updated = await pool.query(
      `UPDATE users
       SET name = $1, modified_at = CURRENT_TIMESTAMP, modified_by = $2
       WHERE id = $3
       RETURNING *`,
      [name, modifiedBy, user_id]
    );

    res
      .status(200)
      .json(response.success("User updated successfully", updated.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json(response.error("Server error"));
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
    console.log(email_user);
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
