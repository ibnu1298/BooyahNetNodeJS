const express = require("express");
const router = express.Router();
const users = require("../controllers/usersController");
const verifyToken = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRole");

router.get("/", users.getAllUsers);
router.post("/", users.createUser);
router.put("/update", verifyToken, checkRole("Admin"), users.updateUser);

module.exports = router;
