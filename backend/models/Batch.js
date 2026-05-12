const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g., "BCA 3rd Sem", "MCA 1st Year"
    guide: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Project Guide
    teamLeader: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // Team Leader
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    assignedProjects: [{
      project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
      assignedDate: { type: Date, default: Date.now },
      deadline: { type: Date, required: true },
      status: { type: String, enum: ["active", "completed", "cancelled"], default: "active" }
    }],
    timings: {
      startTime: { type: String, default: "09:00" },
      endTime: { type: String, default: "18:00" }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Batch", batchSchema);