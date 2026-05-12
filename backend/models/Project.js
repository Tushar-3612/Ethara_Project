const mongoose = require("mongoose");

const formatRemainingTime = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return "0m";
  const totalMinutes = Math.ceil(ms / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
};

// Individual requirement schema
 const requirementSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: "", trim: true },
  priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
  deadline: { type: Date, required: true },
  timeLimitHours: { type: Number, default: 0, min: 0 },        // ✅ 48 ko 0 kar diya
  timeLimitMinutes: { type: Number, default: 0, min: 0, max: 59 },
  timeLimitSeconds: { type: Number, default: 0, min: 0, max: 59 },  // ✅ NAYA FIELD ADD KIYA
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  startedAt: { type: Date, default: null },
  startedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  completedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
});
// Virtual for time limit display
// ✅ YEH PURE VIRTUAL KO REPLACE KAR DO (around line 40-50)
requirementSchema.virtual("timeLimitDisplay").get(function() {
  const hours = this.timeLimitHours || 0;
  const minutes = this.timeLimitMinutes || 0;
  const seconds = this.timeLimitSeconds || 0;
  
  // Agar sab 0 hai to "No time limit"
  if (hours === 0 && minutes === 0 && seconds === 0) {
    return "No time limit";
  }
  
  const parts = [];
  if (hours > 0) parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? 's' : ''}`);
  if (seconds > 0) parts.push(`${seconds} second${seconds > 1 ? 's' : ''}`);
  
  return parts.join(" ");
});

// Virtual for total time limit in minutes
requirementSchema.virtual("totalTimeLimitMinutes").get(function() {
  return (this.timeLimitHours || 0) * 60 + (this.timeLimitMinutes || 0);
});

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    difficulty: { type: String, enum: ["basic", "moderate", "hard"], default: "basic", index: true },
    platform: { type: String, default: "", trim: true },
    priority: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    guide: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    supportRole: {
      role: { type: String, enum: ["reviewer", "team_lead", "coordinator"], default: "reviewer" },
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    },
    targetBatches: [{ type: String, trim: true, index: true }],
    approvedBatches: [{ type: String, trim: true, index: true }],
    batchApprovalRequired: { type: Boolean, default: true },
    deadline: { type: Date, default: null },
    workStartTime: { type: String, default: "" },
    workEndTime: { type: String, default: "" },
    completionTargetCount: { type: Number, default: 1, min: 1 },
    lastRequirementAddedAt: { type: Date, default: null },
    
    requirements: [requirementSchema],
    
    completionMarks: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        completedAt: { type: Date, default: Date.now },
      },
    ],
    memberStatuses: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        status: {
          type: String,
          enum: ["pending", "in-progress", "completed", "blocked"],
          default: "pending",
        },
        startedAt: { type: Date, default: null },
        completedAt: { type: Date, default: null },
        updatedAt: { type: Date, default: Date.now },
        completedRequirements: [{ type: mongoose.Schema.Types.ObjectId, ref: "Requirement" }],
        currentRequirement: { type: mongoose.Schema.Types.ObjectId, ref: "Requirement", default: null },
      },
    ],
    completedAt: { type: Date, default: null },
    completedByGuide: { type: Boolean, default: false },
    /** Admin workflow: pending projects need approval to be visible in admin filters / lifecycle */
    adminApproval: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: check if all requirements are completed
projectSchema.virtual("allRequirementsCompleted").get(function() {
  if (!this.requirements || this.requirements.length === 0) return false;
  return this.requirements.every(req => req.status === "completed");
});

// Virtual: count of completed requirements
projectSchema.virtual("completedRequirementsCount").get(function() {
  if (!this.requirements) return 0;
  return this.requirements.filter(req => req.status === "completed").length;
});

// Virtual: total requirements count
projectSchema.virtual("totalRequirementsCount").get(function() {
  return this.requirements?.length || 0;
});

projectSchema.virtual("isDeadlinePassed").get(function getIsDeadlinePassed() {
  if (!this.deadline) return false;
  const deadline = new Date(this.deadline).getTime();
  if (Number.isNaN(deadline)) return false;
  return Date.now() >= deadline;
});

projectSchema.virtual("remainingTime").get(function getRemainingTime() {
  if (!this.deadline) return null;
  const deadline = new Date(this.deadline).getTime();
  if (Number.isNaN(deadline)) return null;
  const leftMs = deadline - Date.now();
  if (leftMs <= 0) return "0m";
  return formatRemainingTime(leftMs);
});

// Helper method to check if a user can complete a requirement
projectSchema.methods.canCompleteRequirement = function(requirementId, userId) {
  const requirement = this.requirements.id(requirementId);
  if (!requirement) return { canComplete: false, reason: "Requirement not found" };
  
  if (requirement.status === "completed") {
    return { canComplete: false, reason: "This requirement has already been completed by someone else" };
  }
  
  const now = new Date();
  if (now < requirement.deadline) {
    const remaining = formatRemainingTime(requirement.deadline - now);
    return { canComplete: false, reason: `Time limit not reached. Wait ${remaining} more` };
  }
  
  return { canComplete: true };
};

// Helper method to complete a requirement
projectSchema.methods.completeRequirement = async function(requirementId, userId, userName) {
  const requirement = this.requirements.id(requirementId);
  if (!requirement) throw new Error("Requirement not found");
  
  const check = this.canCompleteRequirement(requirementId, userId);
  if (!check.canComplete) throw new Error(check.reason);
  
  requirement.status = "completed";
  requirement.completedBy = userId;
  requirement.completedAt = new Date();
  
  const memberStatus = this.memberStatuses.find(ms => ms.user.toString() === userId.toString());
  if (memberStatus) {
    if (!memberStatus.completedRequirements) memberStatus.completedRequirements = [];
    memberStatus.completedRequirements.push(requirement._id);
    memberStatus.currentRequirement = null;
    memberStatus.updatedAt = new Date();
  }
  
  await this.save();
  return requirement;
};

module.exports = mongoose.model("Project", projectSchema);