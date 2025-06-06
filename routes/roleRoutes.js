const express = require("express");
const router = express.Router();
const rolesController = require("../controllers/rolesController");
const { verifyToken } = require("../middleware/authMiddleware");

router.post("/", rolesController.createRole);
router.get("/", rolesController.getAllRoles);

module.exports = router;
