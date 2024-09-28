const { TryCatch, ErrorHandler } = require("../utils/ErrorHandler");
const { Chat } = require("../models/chat");
const { User } = require("../models/user");
const Message = require("../models/message");
const { getOtherMember } = require("../lib/helper");
const {
  emitEvent,
  deleteFilesFromCloudnary,
  uploadFilesToCloudinary,
} = require("../utils/feature");
const {
  ALERT,
  REFETCH_CHAT,
  NEW_MESSAGE_ALERT,
  NEW_MESSAGE,
  MESSAGE_DELETE,
} = require("../constants/events");

const newGroupChat = TryCatch(async (req, res, next) => {
  const { name, members } = req.body;

  const allMembers = [...members, req.userId]; // add yourself into group

  await Chat.create({
    name,
    groupChat: true,
    creator: req.userId,
    members: allMembers,
  });

  emitEvent(req, ALERT, allMembers, `Welcome to ${name} group`);
  emitEvent(req, REFETCH_CHAT, members);

  return res.status(201).json({
    success: true,
    message: "Group Created",
  });
});

const getMyChats = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.userId,
  }).populate("members", "name avatar");

  // we can also use aggregation pipeline here
  const transformedChats = chats.map(({ _id, name, members, groupChat }) => {
    const otherMember = getOtherMember(members, req.userId);
    return {
      _id,
      groupChat,
      avatar: groupChat
        ? members.slice(0, 3).map(({ avatar }) => avatar?.url)
        : [otherMember?.avatar?.url],
      name: groupChat ? name : otherMember?.name,
      members: members.reduce((prev, curr) => {
        if (curr._id.toString() !== req.userId.toString()) {
          prev.push(curr._id);
        }
        return prev;
      }, []),
    };
  });
  return res.status(200).json({ success: true, chats: transformedChats });
});

const getMyGroups = TryCatch(async (req, res, next) => {
  const chats = await Chat.find({
    members: req.userId,
    groupChat: true,
    creator: req.userId,
  }).populate("members", "name avatar");

  const groups = chats.map(({ _id, name, members, groupChat }) => {
    return {
      _id,
      groupChat,
      name,
      avatar: members.slice(0, 3).map(({ avatar }) => avatar?.url),
    };
  });

  return res.status(200).json({ success: true, groups });
});

const addMembers = TryCatch(async (req, res, next) => {
  const { chatId, members } = req.body;
  const chat = await Chat.findById(chatId);

  // Validations
  if (!chat) return next(new ErrorHandler("Chat not found", 404));
  if (!chat.groupChat)
    return next(new ErrorHandler("This is not Group Chat", 400));

  if (!members || members.length < 1)
    return next(new ErrorHandler("Please Provide Members", 400));

  // if user is tries to add members in a group, where he/she is not creator of the group then they can't add members
  if (chat.creator.toString() !== req.userId.toString())
    return next(new ErrorHandler("You are not admin of this group", 403));

  const allNewMembersPromise = members.map((member) =>
    User.findById(member, "name")
  );

  const allNewMembers = await Promise.all(allNewMembersPromise);

  // unique members validation
  const uniqueMembers = allNewMembers.filter(
    (member) => !chat.members.includes(member._id)
  );

  // chat.members.push(...uniqueMembers.map((member) => member._id));
  chat.members.push(...uniqueMembers);

  if (chat.members.length > 100) {
    return next(new ErrorHandler("Can't add more than 100 members", 400));
  }

  await chat.save();
  const allUserName = allNewMembers.map(({ name }) => name).join(",");

  emitEvent(
    req,
    ALERT,
    chat.members,
    `${allUserName} you have been added in this group`
  );

  emitEvent(req, REFETCH_CHAT, chat.members);

  return res
    .status(200)
    .json({
      success: true,
      message: `Members Added in ${chat.name} Successfully`,
    });
});

const removeMembers = TryCatch(async (req, res, next) => {
  const { chatId, userId } = req.body;

  const [chat, userThatwillBeRemoved] = await Promise.all([
    Chat.findById(chatId),
    User.findById(userId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));
  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  if (chat.creator.toString() !== req.userId.toString()) {
    return next(
      new ErrorHandler("You are not authorized to remove members", 403)
    );
  }

  if (chat.members.length <= 3) {
    return next(new ErrorHandler("Group must have atleast 3 members", 400));
  }

  const allMembers = chat.members.map((i) => i.toString());

  chat.members = chat.members.filter(
    (member) => member.toString() !== userId.toString()
  );

  await chat.save();
  emitEvent(req, ALERT, chat.members, {
    message: `${userThatwillBeRemoved.name} has been removed from the group`,
    chatId,
  });

  emitEvent(req, REFETCH_CHAT, allMembers);

  return res.status(200).json({ success: true, message: "Member Removed" });
});

const leaveGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));

  const remainingMembers = chat.members.filter(
    (member) => member.toString() !== req.userId.toString()
  );

  // if Group admin itself want to leave group
  if (chat.creator.toString() === req.userId.toString()) {
    const randomElement = Math.floor(Math.random() * remainingMembers.length);
    const newCreator = remainingMembers[randomElement];
    chat.creator = newCreator;
  }

  if (remainingMembers.length < 3) {
    // make this group as normal chat
    chat.groupChat = false;
    chat.members = remainingMembers;
    await chat.save();
    return res
      .status(200)
      .json({ success: true, message: "You left the Group Successfully" });
  }

  chat.members = remainingMembers;
  const [user] = await Promise.all([User.findById(req.userId), chat.save()]);

  emitEvent(req, ALERT, remainingMembers, {
    message: `${user.name} has left the group`,
    chatId,
  });
  return res
    .status(200)
    .json({ success: true, message: "You left the Group Successfully" });
});

const sendAttachments = TryCatch(async (req, res, next) => {
  const { chatId } = req.body;

  const [chat, sender] = await Promise.all([
    Chat.findById(chatId),
    User.findById(req.userId, "name"),
  ]);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  const files = req.files || [];
  if (files.length < 1) return next(new ErrorHandler("No file Choosen", 400));
  if (files.length > 15)
    return next(new ErrorHandler("Can't send more than 15 files", 400));

  // Upload files here
  const attachments = await uploadFilesToCloudinary(files);

  const messageForDB = {
    content: "",
    attachments,
    sender: sender._id,
    chat: chatId,
  };

  const message = await Message.create(messageForDB);

  const messageForRealTime = {
    _id: message._id,
    content: message.content,
    attachments: message.attachments,
    sender: {
      _id: sender._id,
      name: sender.name,
    },
  };

  emitEvent(req, NEW_MESSAGE, chat.members, {
    message: messageForRealTime,
    chatId,
  });

  // inform all the members of the chat
  emitEvent(req, NEW_MESSAGE_ALERT, chat.members, { chatId });

  return res.status(200).json({ success: true, message });
});

const getChatDetails = TryCatch(async (req, res, next) => {
  if (req.query.populate === "true") {
    const chat = await Chat.findById(req.params.id)
      .populate("members", "name avatar")
      .lean();

    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    chat.members = chat.members.map(({ _id, name, avatar }) => ({
      _id,
      name,
      avatar: avatar.url,
    }));

    return res.status(200).json({
      success: true,
      chat,
    });
  } else {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return next(new ErrorHandler("Chat not found", 404));

    return res.status(200).json({
      success: true,
      chat,
    });
  }
});

const renameGroup = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const { name } = req.body;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.groupChat)
    return next(new ErrorHandler("This is not a group chat", 400));
  if (chat.creator.toString() !== req.userId.toString())
    return next(
      new ErrorHandler("You are not authorized to rename group", 403)
    );

  chat.name = name;
  await chat.save();
  emitEvent(req, REFETCH_CHAT, chat.members);

  return res.status(200).json({ success: true, message: "Group Renamed" });
});

const deleteChat = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (chat.groupChat && chat.creator.toString() !== req.userId.toString()) {
    return next(
      new ErrorHandler("You are not authorized to delete this group", 403)
    );
  }

  if (chat.groupChat && !chat.members.includes(req.userId.toString())) {
    return next(
      new ErrorHandler("You are not allowed to delete the chat", 403)
    );
  }

  // here we have to delete all messages related to the chat
  const messageWithAttachments = await Message.find({
    chat: chatId,
    attachments: { $exists: true, $ne: [] },
  });

  const public_ids = [];

  messageWithAttachments.forEach(({ attachments }) =>
    attachments.forEach(({ public_id }) => public_ids.push(public_id))
  );

  await Promise.all([
    deleteFilesFromCloudnary(public_ids),
    chat.deleteOne(),
    Message.deleteMany({ chat: chatId }),
  ]);

  emitEvent(req, REFETCH_CHAT, chat.members);

  return res
    .status(200)
    .json({ success: true, message: "Chat Deleted Successfully" });
});

const getMessages = TryCatch(async (req, res, next) => {
  const chatId = req.params.id;
  const { page = 1 } = req.query;

  const resPerPage = 20;
  const skip = (page - 1) * resPerPage;

  const chat = await Chat.findById(chatId);

  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  if (!chat.members.includes(req.userId.toString()))
    return next(
      new ErrorHandler("You're no longer a member of this chat", 403)
    );

  const [messages, totalMessagesCount] = await Promise.all([
    Message.find({ chat: chatId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(resPerPage)
      .populate("sender", "name")
      .lean(),
    Message.countDocuments({ chat: chatId }),
  ]);
  const totalPages = Math.ceil(totalMessagesCount / resPerPage) || 0;

  return res.status(200).json({
    success: true,
    messages: messages.reverse(),
    totalPages,
  });
});

const deleteMessage = TryCatch(async (req, res, next) => {
  const { chatId, messageId } = req.params;

  const chat = await Chat.findById(chatId);
  if (!chat) return next(new ErrorHandler("Chat not found", 404));

  const message = await Message.findById(messageId);
  if (!message) return next(new ErrorHandler("Message not found", 404));

  if (message.sender.toString() !== req.userId.toString())
    return next(
      new ErrorHandler("You are not authorized to delete this message", 403)
    );

  await Message.findByIdAndDelete(messageId);

  emitEvent(req, MESSAGE_DELETE, chat.members, { chatId, messageId });

  return res.status(200).json({ success: true, message: "Message deleted" });
});

module.exports = {
  newGroupChat,
  getMyChats,
  getMyGroups,
  addMembers,
  removeMembers,
  leaveGroup,
  sendAttachments,
  getChatDetails,
  renameGroup,
  deleteChat,
  getMessages,
  deleteMessage,
};
