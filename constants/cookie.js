const cookieOptions = {
  // 15 days of expiration
  maxAge: 15 * 24 * 60 * 60 * 1000,
  sameSite: "none",
  httpOnly: true,
  secure: true,
};

module.exports = { cookieOptions }