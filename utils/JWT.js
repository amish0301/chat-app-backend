const jwt = require("jsonwebtoken");
const { cookieOptions } = require("../constants/cookie");

const sendToken = (res, user, code, message) => {
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);

  return res.status(code).cookie("uid", token, cookieOptions).json({
    success: true,
    message: message,
  });
};

module.exports = { sendToken };
