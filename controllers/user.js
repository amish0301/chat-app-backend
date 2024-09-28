const { User } = require("../models/user");
const { Chat } = require("../models/chat");
const { Request } = require("../models/request");
const { sendToken } = require("../utils/JWT");
const bcrypt = require("bcryptjs");
const { cookieOptions } = require("../constants/cookie");
const { ErrorHandler, TryCatch } = require("../utils/ErrorHandler");
const { NEW_REQUEST, REFETCH_CHAT } = require("../constants/events");
const { emitEvent, uploadFilesToCloudinary } = require("../utils/feature");
const { getOtherMember } = require("../lib/helper");

// SIGN-UP
const newUser = TryCatch(async (req, res, next) => {
  const { name, username, password, bio } = req.body;

  const file = req.file;
  if (!file)
    return next(new ErrorHandler("Please Upload Your Profile Picture", 400));

  const result = await uploadFilesToCloudinary([file]);

  const avatar = {
    public_id: result[0].public_id,
    url: result[0].url,
  };

  const isExist = await User.findOne({ username }).select("+password");

  if (isExist) return res.status(400).json({ success: false, message: "Username Already Exist!" });

  // hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await User.create({
    name,
    username,
    password: hashedPassword,
    avatar,
    bio,
  });

  await user.save();

  return res.status(200).json({ success: true, message: "User Created Successfully" });
});

// LOG-IN
const login = TryCatch(async (req, res, next) => {
  const { username, password } = req.body;

  const user = await User.findOne({ username }).select("+password");
  if (!user) {
    return next(new ErrorHandler("Invalid Username or Password", 404));
  }

  const isMatchPassword = await bcrypt.compare(password, user.password);
  if (!isMatchPassword) {
    return next(new ErrorHandler("Invalid Username or Password", 404));
  }

  sendToken(res, user, 200, `Welcome Back ${user.name}`);
});

// LOG-OUT
const logout = async (req, res) => {
  await User.findByIdAndDelete(req.userId);

  return res
    .status(200)
    .cookie("uid", "", { ...cookieOptions, maxAge: 0 })
    .json({ success: true, message: "Logged Out Successfully" });
};

// Search  User
const searchUser = TryCatch(async (req, res, next) => {
  const { name = "" } = req.query;

  // finding all my chats
  const myChats = await Chat.find({
    groupChat: false,
    members: req.userId,
  });

  // extracting all users from my chats
  const allUsersFromMyChats = myChats.flatMap((chat) => chat.members);

  // finding all users except my chats
  const allUsersExceptMyChats = await User.find({
    _id: { $nin: allUsersFromMyChats , $ne: req.userId },
    name: { $regex: name, $options: "i" },
  });

  const users = allUsersExceptMyChats.map(({ _id, name, avatar }) => ({
    _id,
    name,
    avatar: avatar?.url,
  }));

  return res.status(200).json({ success: true, users });
});

// SEND FRIEND REQUEST
const sendFriendRequest = TryCatch(async (req, res, next) => {
  const { receiverId } = req.body;
  const request = await Request.findOne({
    $or: [
      { sender: req.userId, receiver: receiverId },
      { sender: receiverId, receiver: req.userId },
    ],
  });

  if (request) {
    return next(new ErrorHandler("Friend Request Already Sent", 400));
  }

  await Request.create({
    sender: req.userId,
    receiver: receiverId,
  });

  emitEvent(req, NEW_REQUEST, [receiverId]);

  return res
    .status(200)
    .json({ success: true, message: "Friend Request Sent" });
});

// ACCEPT FRIEND REQUEST
const acceptFriendRequest = TryCatch(async (req, res, next) => {
  const { requestId, accept } = req.body;
  const request = await Request.findById(requestId)
    .populate("sender", "name")
    .populate("receiver", "name");

  if (!request) return next(new ErrorHandler("Request Not Found", 404));

  if (request.receiver._id.toString() !== req.userId)
    return next(
      new ErrorHandler("You are not authorised to accept this Request", 401)
    );

  if (!accept) {
    await request.deleteOne();
    return res
      .status(200)
      .json({ success: true, message: "Friend Request Rejected" });
  }

  const members = [request.sender._id, request.receiver._id];
  await Promise.all([
    Chat.create({
      members,
      name: `${request.sender.name} - ${request.receiver.name}`,
    }),
    request.deleteOne(),
  ]);

  emitEvent(req, REFETCH_CHAT, members);

  return res.status(200).json({
    success: true,
    message: "Friend Request Accepted",
    senderId: request.sender._id,
    sendername: request.sender.name,
  });
});

// GET MY NOTIFICATIONS
const getMyNotifications = TryCatch(async (req, res, next) => {
  const request = await Request.find({ receiver: req.userId }).populate(
    "sender",
    "name avatar"
  );

  const allRequest = request.map(({ sender, _id }) => ({
    _id,
    sender: {
      _id: sender._id,
      name: sender.name,
      avatar: sender.avatar?.url,
    },
  }));

  return res.status(200).json({ success: true, requests: allRequest });
});

const getMyFriends = TryCatch(async (req, res, next) => {
  const chatId = req.query.chatId;

  const chat = await Chat.find({
    members: req.userId,
    groupChat: false,
  }).populate("members", "name avatar");

  const friends = chat.map(({ members }) => {
    const otherUser = getOtherMember(members, req.userId);
    return {
      _id: otherUser._id,
      name: otherUser.name,
      avatar: otherUser.avatar?.url,
    };
  });

  // if chatId provided, then filter out the friends that are already in the chat
  if (chatId) {
    const chat = await Chat.findById(chatId);
    const availableFriends = friends.filter(
      (friend) => !chat.members.includes(friend._id)
    );

    return res.status(200).json({ success: true, friends: availableFriends });
  }

  return res.status(200).json({ success: true, friends });
});

const deleteUser = TryCatch(async (req, res, next) => {
  await User.findByIdAndDelete(req.params.id);

  return res
    .status(200)
    .json({ success: true, message: "User Deleted Successfully" });
});

const getMyProfile = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.userId);
  if (!user) {
    return next(new ErrorHandler("User Not found", 404));
  }
  return res.status(200).json({ success: true, user });
});

module.exports = {
  newUser,
  login,
  logout,
  searchUser,
  getMyProfile,
  deleteUser,
  sendFriendRequest,
  acceptFriendRequest,
  getMyNotifications,
  getMyFriends,
};
