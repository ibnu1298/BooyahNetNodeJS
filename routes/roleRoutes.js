const express = require("express");
const router = express.Router();
const role = require("../controllers/rolesController");
const verifyToken = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRole");

router.post("/", verifyToken, checkRole("Admin"), role.createRole);
router.get("/", verifyToken, checkRole("Admin"), role.getAllRoles);

module.exports = router;
