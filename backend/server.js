require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const projectRoutes = require("./routes/projectRoutes");
const taskRoutes = require("./routes/taskRoutes");
const activityRoutes = require("./routes/activityRoutes");
const userRoutes = require("./routes/userRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const requirementRoutes = require("./routes/requirementRoutes");
const workLogRoutes = require("./routes/workLogRoutes");
const leaveRoutes = require("./routes/leaveRoutes");
const reportRoutes = require("./routes/reportRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

/** Comma-separated in CLIENT_ORIGIN; in non-production, common Vite ports are always allowed too. */
const fromEnv = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean)
  : [];
const devViteOrigins =
  process.env.NODE_ENV === "production"
    ? []
    : [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
      ];
const allowedOrigins = [...new Set([...fromEnv, ...devViteOrigins])];
const corsOrigin =
  allowedOrigins.length > 0
    ? allowedOrigins
    : process.env.NODE_ENV === "production"
      ? false
      : true;

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ message: "Team Task Manager API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/activities", activityRoutes);
app.use("/api/users", userRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/requirements", requirementRoutes);
app.use("/api/work-logs", workLogRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/admin", adminRoutes);

// Basic error boundary
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.statusCode || 500;
  res.status(status).json({ message: err.message || "Server error" });
});

const PORT = process.env.PORT || 5000;
// 🔥 FIX: Support both MONGO_URI and MONGODB_URI
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log(`✅ MongoDB connected successfully`);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("❌ Database connection failed:", error.message);
    process.exit(1);
  }
};

startServer();