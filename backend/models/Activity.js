const mongoose = require("mongoose");

const ACTIVITY_TYPES = [
  "project_created",
  "task_assigned",
  "task_status_updated",
  "task_completed",
  "project_started",
  "project_joined",
  "project_left",
  "requirements_updated",
  "requirement_completed",
  "user_kicked",
  "user_restored",
];

const activitySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ACTIVITY_TYPES,
      required: true,
    },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", default: null },
    task: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    message: { type: String, required: true, trim: true },
    meta: { type: Object, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Activity", activitySchema);
