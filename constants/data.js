// admin stuff
const adminSecretKey = process.env.ADMIN_SECRET_KEY || "admin";
const userSocketIDs = new Map();
const onlineUsers = new Set();

module.exports = {
  adminSecretKey,
  userSocketIDs,
  onlineUsers
};