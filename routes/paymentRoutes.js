const express = require("express");
const router = express.Router();
const payment = require("../controllers/paymentsController");
const verifyToken = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRole");

router.get("/", verifyToken, checkRole("Admin"), payment.getAllPayments);
router.get("/:id", verifyToken, payment.getPaymentById);
router.get("/users/:user_id", verifyToken, payment.getPaymentByUserId);
router.get(
  "/download-receipt/:payment_id",
  verifyToken,
  payment.downloadReceipt
);
router.post("/", verifyToken, checkRole("Admin"), payment.createPayment);
router.post("/update", verifyToken, checkRole("Admin"), payment.UpdatePayment);
router.post("/send-kwitansi", verifyToken, checkRole("Admin"), payment.sendPDF);

module.exports = router;
