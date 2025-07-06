const express = require("express");
const router = express.Router();
const users = require("../controllers/usersController");
const verifyToken = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRole");

router.get("/", verifyToken, checkRole("Admin"), users.getAllUsers);
router.get(
  "/withTotalPayments",
  verifyToken,
  checkRole("Admin"),
  users.getAllUsersWithPayments
);
router.put(
  "/update-by-admin",
  verifyToken,
  checkRole("Admin"),
  users.updateByAdmin
);

router.get("/:id", verifyToken, users.getUserById);
router.put("/update", verifyToken, users.updateUser);
router.post(
  "/update-role",
  verifyToken,
  checkRole("Admin"),
  users.updateUserRole
);
router.post(
  "/update-or-insert-user-detail",
  verifyToken,
  users.updateInsertUserDetail
);

module.exports = router;
