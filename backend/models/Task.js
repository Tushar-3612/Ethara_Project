const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: "Requirement", default: null, index: true },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in-progress", "completed", "blocked"],
      default: "pending",
    },
    deadline: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedRequirements: [{ type: mongoose.Schema.Types.ObjectId, ref: "Requirement" }],
  },
  { timestamps: true }
);

taskSchema.virtual("isOverdue").get(function isOverdue() {
  if (!this.deadline) return false;
  if (this.status === "completed") return false;
  return new Date(this.deadline).getTime() < Date.now();
});

taskSchema.set("toJSON", { virtuals: true });
taskSchema.set("toObject", { virtuals: true });

/**
 * For tasks tied to one requirement: mark that requirement done and set task completed if appropriate.
 */
taskSchema.methods.addCompletedRequirementAndRefreshStatus = async function (requirementId) {
  const idStr = requirementId.toString();
  const has = (this.completedRequirements || []).some((id) => id.toString() === idStr);
  if (!has) this.completedRequirements.push(requirementId);

  const linked = this.requirementId && this.requirementId.toString() === idStr;
  if (linked) {
    this.status = "completed";
    this.completedAt = new Date();
  }
  await this.save();
  return this;
};

taskSchema.methods.allLinkedRequirementsDone = function (totalRequirementCount) {
  if (!this.requirementId) return this.status === "completed";
  if (!Number.isFinite(totalRequirementCount) || totalRequirementCount <= 0) return this.status === "completed";
  return this.completedRequirements.length >= totalRequirementCount;
};

module.exports = mongoose.model("Task", taskSchema);
