

const corsOptions = {
  origin: [process.env.CLIENT_URL, "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

module.exports = { corsOptions };