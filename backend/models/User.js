const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "guide", "member"],
      default: "member",
    },
    batch: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },
    assignedBatch: {
      type: String,
      default: "",
      trim: true,
    },
    guideType: {
      type: String,
      enum: ["guide", "leader"],
      default: "guide",
    },
    canEditAttendance: {
      type: Boolean,
      default: true,
    },
    rating: { type: Number, min: 1, max: 5, default: 3 },
    /** Display stars 1–5 for guides (derived from completion rate thresholds). */
    stars: { type: Number, min: 1, max: 5, default: 3 },
    /** Cached aggregates for admin dashboards (optional). */
    performanceMetrics: {
      completionRatePct: { type: Number, default: 0 },
      projectsApproved: { type: Number, default: 0 },
      studentCount: { type: Number, default: 0 },
      attendanceAvgPct: { type: Number, default: 0 },
      updatedAt: { type: Date, default: null },
    },
    completedTasks: { type: Number, default: 0 },
    completedProjects: { type: Number, default: 0 },
    totalWorkHours: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
    /** When false, login is blocked (kicked). Default true for all new accounts. */
    isActive: { type: Boolean, default: true },
    kickedAt: { type: Date, default: null },
    currentProject: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
