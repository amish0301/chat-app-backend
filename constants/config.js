const allowedOrigins = process.env.CLIENT_URI.split(',').map(origin => origin.trim());

const corsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"],
};

module.exports = { corsOptions };