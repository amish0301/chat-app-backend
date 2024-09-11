const express = require("express");
const router = express.Router();
const {
  newUser,
  deleteUser,
  login,
  getMyProfile,
  logout,
  searchUser,
  sendFriendRequest,
  getMyNotifications,
  acceptFriendRequest,
  getMyFriends
} = require("../controllers/user");
const { singleAvatar } = require("../middlewares/multer");
const { isAuthenticated } = require("../middlewares/auth");
const {
  registerValidator,
  validateHandler,
  loginValidator,
  sendRequestValidator,
  acceptrequestValidator,
} = require("../lib/validators");

router.post(
  "/signup",
  singleAvatar,
  registerValidator(),
  validateHandler,
  newUser
);

router.post("/login", loginValidator(), validateHandler, login);

// middleware
router.use(isAuthenticated);

router.get("/search", searchUser);
router.put(
  "/sendrequest",
  sendRequestValidator(),
  validateHandler,
  sendFriendRequest
);
router.put(
  "/acceptrequest",
  acceptrequestValidator(),
  validateHandler,
  acceptFriendRequest
);

router.get('/notifications', getMyNotifications);
router.get('/friends', getMyFriends);

router.get("/logout", logout);
router.post("/:id", deleteUser);

// personal info routes
router.get("/me", getMyProfile);

module.exports = router;
