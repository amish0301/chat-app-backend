const { TryCatch, ErrorHandler } = require("../utils/ErrorHandler");
const { User } = require("../models/user");
const { Chat } = require("../models/chat");
const Message = require("../models/message");
const jwt = require("jsonwebtoken");
const { cookieOptions } = require("../constants/cookie");
const { adminSecretKey } = require("../constants/data");

const adminLogin = TryCatch(async (req, res, next) => {
  const { secretKey } = req.body;
  const isMatch = secretKey === adminSecretKey;

  if (!isMatch) return next(new ErrorHandler("Invalid Admin Key", 401));

  const token = jwt.sign({ secretKey }, process.env.JWT_SECRET);
  return res
    .status(200)
    .cookie("adminToken", token, {
      ...cookieOptions,
      maxAge: 6 * 60 * 60 * 1000,
    })
    .json({ success: true, message: "Admin Logged In Successfully" });
});

const adminLogout = TryCatch(async (req, res, next) => {
  return res
    .clearCookie("adminToken")
    .status(200)
    .json({ success: true, message: "Admin Logged Out Successfully" });
});

const getAdminData = TryCatch(async (req, res, next) => {
  return res.status(200).json({ admin: true });
});

const getUsers = TryCatch(async (req, res, next) => {
  const users = await User.find().select('name username avatar _id');

  const transformedUsers = await Promise.all(
    users.map(async ({ name, username, avatar, _id }) => {
      const [groups, friends] = await Promise.all([
        Chat.countDocuments({ groupChat: true, members: _id }),
        Chat.countDocuments({ groupChat: false, members: _id }),
      ]);

      return {
        name,
        username,
        avatar: avatar?.url,
        _id,
        groups,
        friends,
      };
    })
  );

  return res.status(200).json({
    success: true,
    allUsers: transformedUsers,
  });
});

const getChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({})
    .populate("members", "name avatar")
    .populate("creator", "name avatar");

  const transformedChats = await Promise.all(
    chats.map(async ({ name, members, _id, groupChat, creator }) => {
      const totalMessages = await Chat.countDocuments({ chat: _id });
      return {
        _id,
        name,
        groupChat,
        avatar: members.slice(0, 3).map((member) => member.avatar?.url),
        members: members.map(({ _id, name, avatar }) => {
          return {
            _id,
            name,
            avatar: avatar?.url,
          };
        }),
        creator: {
          name: creator?.name || "None",
          avatar: creator?.avatar?.url || "",
        },
        totalMembers: members.length,
        totalMessages,
      };
    })
  );

  return res.status(200).json({ success: true, chats: transformedChats });
});

const getMessages = TryCatch(async (req, res, next) => {
  const messages = await Message.find()
    .populate("sender", "name avatar")
    .populate("chat", "groupChat");

  const transformedMessages = messages.map(
    ({ _id, attachments, content, createdAt, sender, chat }) => ({
      _id,
      content,
      createdAt,
      attachments,
      chat: chat._id,
      groupChat: chat.groupChat,
      sender: {
        _id: sender._id,
        name: sender.name,
        avatar: sender.avatar?.url,
      },
    })
  );

  return res.status(200).json({ success: true, messages: transformedMessages });
});

const getDashboardStats = TryCatch(async (req, res, next) => {
  const [groupsCount, userCount, messagesCount, totalChatCount] =
    await Promise.all([
      Chat.countDocuments({ groupChat: true }),
      User.countDocuments(),
      Message.countDocuments(),
      Chat.countDocuments(),
    ]);

  // Dashboard Stats
  const today = new Date();
  const last7Days = new Date();
  last7Days.setDate(today.getDate() - 7);

  const last7DaysMessages = await Message.find({
    createdAt: { $gte: last7Days, $lte: today },
  }).select("createdAt");

  const messages = new Array(7).fill(0);
  const dayInMiliSeconds = 1000 * 60 * 60 * 24;

  last7DaysMessages.forEach((message) => {
    const idx = Math.floor(
      (today.getTime() - message.createdAt.getTime()) / dayInMiliSeconds
    );

    messages[6 - idx]++;
  });

  const stats = {
    groupsCount,
    userCount,
    messagesCount,
    totalChatCount,
    messagesChart: messages,
  }

  return res
    .status(200)
    .json({ success: true, stats });
});

module.exports = {
  getUsers,
  getChats,
  getMessages,
  getDashboardStats,
  adminLogin,
  adminLogout,
  getAdminData,
};
