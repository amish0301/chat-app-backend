const corsOptions = {
  origin: [
    process.env.CLIENT_URI,
    "http://localhost:5173",
    "http://localhost:4173",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
};

module.exports = { corsOptions };
