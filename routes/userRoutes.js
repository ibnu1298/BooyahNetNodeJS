const express = require("express");
const router = express.Router();
const users = require("../Controllers/UsersController");
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
  "/update-billing-date",
  verifyToken,
  checkRole("Admin"),
  users.updateBillingDate
);
router.get("/:id", verifyToken, users.getUserById);
router.put("/update", verifyToken, users.updateUser);
router.post("/update-role", verifyToken, users.updateUserRole);
router.post(
  "/update-or-insert-user-detail",
  verifyToken,
  users.updateInsertUserDetail
);

module.exports = router;
