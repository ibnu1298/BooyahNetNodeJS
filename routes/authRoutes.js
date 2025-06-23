const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");

router.post("/register", auth.register);
router.post("/register-with-whatsapp", auth.registerWithWhatsapp);
router.post("/login", auth.login);
router.post("/refresh-token", auth.refreshToken);
router.post("/login-wa", auth.loginWhatsAppWithOTP);
router.post("/login-email", auth.loginEmailWithOTP);
router.post("/logout", auth.logout);

module.exports = router;
