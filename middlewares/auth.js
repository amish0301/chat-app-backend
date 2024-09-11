const jwt = require("jsonwebtoken");
const { ErrorHandler } = require("../utils/ErrorHandler");
const { adminSecretKey } = require("../constants/data");
const { User } = require("../models/user");
// require("dotenv").config({ path: path.resolve("/server", "../.env") });

const isAuthenticated = (req, res, next) => {
  try {
    const token = req.cookies[process.env.CHAT_APP_TOKEN];
    if (!token) return next(new ErrorHandler("Please Login First", 401));

    const decodeData = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decodeData._id;

    next();
  } catch (error) {
    console.log(error);
  }
};

const adminAuth = (req, res, next) => {
  try {
    const token = req.cookies[process.env.ADMIN_TOKEN];
    if (!token) return next(new ErrorHandler("Only Admins can access", 401));

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.secretKey !== adminSecretKey)
      return next(new ErrorHandler("Only Admins can access", 401));

    next();
  } catch (error) {
    console.log(error);
  }
};

const socketAuthenticater = async (err, socket, next) => {
  try {
    if (err) return next(err);

    const authToken = socket.request.cookies[process.env.CHAT_APP_TOKEN];
    if (!authToken) return next(new ErrorHandler("Please Login First", 401));
    const decodeData = jwt.verify(authToken, process.env.JWT_SECRET);
    const user = await User.findById(decodeData._id);

    if (!user) return next(new ErrorHandler("Please Login First", 401));
    socket.user = user;

    return next();
  } catch (error) {
    return next(new ErrorHandler("Please Login First", 401));
  }
};

module.exports = { isAuthenticated, adminAuth, socketAuthenticater };
