const cookieOptions = {
  // 15 days of expiration
  maxAge: 1000 * 60 * 60 * 24 * 15,
  sameSite: "None",
  httpOnly: true,
  secure: true,
};

module.exports = { cookieOptions }