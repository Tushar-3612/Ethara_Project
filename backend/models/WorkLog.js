const mongoose = require("mongoose");

const workLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD
    text: { type: String, required: true, trim: true },
    completedTaskIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkLog", workLogSchema);

