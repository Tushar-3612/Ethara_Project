const mongoose = require("mongoose");

/**
 * Standalone requirement (one claimer globally: startedBy / completedBy).
 * Timer uses timeLimitMinutes from startedAt only (no hours/seconds).
 */
const requirementSchema = new mongoose.Schema(
  {
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
    deadline: { type: Date, required: true },
    timeLimitMinutes: { type: Number, default: 0, min: 0 },
    startedAt: { type: Date, default: null },
    /** Student who claimed this requirement (only one globally) */
    startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    completedAt: { type: Date, default: null },
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
  },
  { timestamps: true }
);

requirementSchema.index({ project: 1, status: 1 });

module.exports = mongoose.model("Requirement", requirementSchema);
