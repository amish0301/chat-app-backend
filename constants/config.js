const corsOptions = {
  origin: [process.env.CLIENT_URI, "http://localhost:3000", "http://localhost:5173"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

module.exports = { corsOptions }