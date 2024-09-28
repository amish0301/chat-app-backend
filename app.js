const express = require("express");
const cookieParser = require("cookie-parser");
const { connectMongoDB } = require("./utils/connection");
const { errorHandler } = require("./middlewares/error");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { userSocketIDs, onlineUsers } = require("./constants/data");
const {
  NEW_MESSAGE,
  NEW_MESSAGE_ALERT,
  START_TYPING,
  STOP_TYPING,
  CHAT_JOINED,
  CHAT_LEAVED,
  ONLINE_USERS,
} = require("./constants/events");
const { getSockets } = require("./lib/helper");
const Message = require("./models/message");
const cloudinary = require("cloudinary").v2;
const { socketAuthenticater } = require("./middlewares/auth");
const { corsOptions } = require("./constants/config");

const userRoutes = require("./routes/user");
const chatRoutes = require("./routes/chat");
const adminRoutes = require("./routes/admin");

require("dotenv").config({ path: "./.env" });

// Initialisations
const mongouri = process.env.MONGODB_URL;
const port = process.env.SERVER_PORT || 8000;
const envMode = process.env.NODE_ENV.trim() || "production";

connectMongoDB(mongouri);

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_SECRET_KEY,
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: corsOptions });

// assigning io to use across app
app.set("io", io);

// Middlewares
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.get('/', (req, res) => {
  res.send('Hello from Server!');
})

// Routes
app.use("/api/user", userRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);

// Middleware for Socket
io.use((socket, next) => {
  cookieParser()(
    socket.request,
    socket.request.res,
    async (err) => await socketAuthenticater(err,socket,next)
  );
});

// Socket-io
io.on("connection", (socket) => {
  const user = socket.user;

  // when user connect map user_id with socket_id
  userSocketIDs.set(user?._id.toString(), socket.id);

  // When new message will be send in chat, below listener will be triggered
  // Storing message in DB
  socket.on(NEW_MESSAGE, async ({ chatId, members, message }) => {
    const messageForDB = {
      content: message,
      sender: user?._id,
      chat: chatId,
    };

    try {
      const savedMessage = await Message.create(messageForDB);
      // if location then find the location name and save in db
      const messageForRealtime = {
        content: savedMessage.content,
        _id: savedMessage._id,
        sender: {
          _id: savedMessage.sender,
          name: user?.name,
        },
        chat: chatId,
        createdAt: savedMessage.createdAt,
      };

      // Sockets of all members in a Particular Chat
      const membersSocket = getSockets(members);

      // Notifying all members associated with chatId to client side
      io.to(membersSocket).emit(NEW_MESSAGE, {
        chatId,
        message: messageForRealtime,
      });

      // When new message is sent, alert all members associated with chatId
      io.to(membersSocket).emit(NEW_MESSAGE_ALERT, { chatId });
    } catch (error) {
      console.log("Error saving  message:", error);
      throw new Error(error);
    }
  });

  socket.on(START_TYPING, ({ chatId, members }) => {
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(START_TYPING, { chatId });
  });

  socket.on(STOP_TYPING, ({ chatId, members }) => {
    const membersSocket = getSockets(members);
    io.to(membersSocket).emit(STOP_TYPING, { chatId });
  });

  socket.on(CHAT_JOINED, ({ userId, members }) => {
    onlineUsers.add(userId.toString());

    const memberSocket = getSockets(members);
    io.to(memberSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on(CHAT_LEAVED, ({ userId, members }) => {
    onlineUsers.delete(userId.toString());

    const memberSocket = getSockets(members);
    io.to(memberSocket).emit(ONLINE_USERS, Array.from(onlineUsers));
  });

  socket.on("disconnect", () => {
    userSocketIDs.delete(user._id.toString());
    onlineUsers.delete(user._id.toString());
    socket.broadcast.emit(ONLINE_USERS, Array.from(onlineUsers));
  });
});

app.use(errorHandler); // Middleware for errors

server.listen(port, () =>
  console.log(`Server running on ${port} in ${envMode} mode`)
);
