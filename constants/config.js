const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    process.env.CLIENT_URI,
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
};

module.exports = { corsOptions };
