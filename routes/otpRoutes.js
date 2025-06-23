const express = require("express");
const router = express.Router();
const otp = require("../controllers/otpController");
const verifyToken = require("../middleware/authMiddleware");

router.post("/email", otp.createSendEmailOTP);
router.post("/whatsapp", otp.createSendWhatsAppOTP);
router.post("/unregistered-email", otp.sendOtpToUnregisteredEmail);
router.post("/unregistered-whatsapp", otp.sendOtpToUnregisteredWhatsApp);
router.post("/verification-unregistered", otp.verifyOTPUnregistered);
router.post("/email-verification", verifyToken, otp.verificationEmail);
router.post("/whatsapp-verification", verifyToken, otp.verificationWhatsApp);

module.exports = router;
