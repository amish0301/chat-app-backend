const express = require("express");
const router = express.Router();
const {
  getUsers,
  getChats,
  getMessages,
  getDashboardStats,
  adminLogin,
  adminLogout,
  getAdminData,
} = require("../controllers/admin");

const { adminLoginValidator, validateHandler } = require("../lib/validators");
const { adminAuth } = require("../middlewares/auth");

router.post("/verify", adminLoginValidator(), validateHandler, adminLogin);

router.use(adminAuth);
router.get("/", getAdminData);

router.get("/logout", adminLogout);
router.get("/users", getUsers);
router.get("/chats", getChats);
router.get("/stats", getDashboardStats);
router.get("/messages", getMessages);

module.exports = router;
