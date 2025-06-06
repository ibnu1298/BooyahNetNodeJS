const express = require("express");
const router = express.Router();
const payment = require("../controllers/paymentsController");
const verifyToken = require("../middleware/authMiddleware");

router.get("/", verifyToken, payment.getAllPayments);
router.get("/:id", verifyToken, payment.getPaymentById);
router.get("/users/:user_id", verifyToken, payment.getPaymentByUserId);
router.post("/", verifyToken, payment.createPayment);

module.exports = router;
