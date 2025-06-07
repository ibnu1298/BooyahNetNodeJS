const express = require("express");
const router = express.Router();
const users = require("../controllers/usersController");
const verifyToken = require("../middleware/authMiddleware");
const checkRole = require("../middleware/checkRole");

router.get("/", verifyToken, checkRole("Admin"), users.getAllUsers);
router.get("/:id", verifyToken, users.getUserById);
router.put("/update", verifyToken, users.updateUser);
router.post("/update-role", verifyToken, users.updateUserRole);

module.exports = router;
