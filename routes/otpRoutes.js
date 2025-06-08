const express = require("express");
const router = express.Router();
const otp = require("../controllers/otpController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/email", verifyToken, otp.createSendEmailOTP);

module.exports = router;
