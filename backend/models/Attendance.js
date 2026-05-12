const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    /** Local calendar day key YYYY-MM-DD (server local timezone when created) */
    dateKey: { type: String, required: true },
    /** Kept for backwards compatibility; mirrors dateKey when not explicitly set */
    date: { type: String, required: false },
    punchIn: { type: Date },
    punchInTime: { type: String },
    actualPunchTime: { type: String },
    status: { type: String, enum: ["present", "absent", "late", "half-day"], default: "absent" },
    isLate: { type: Boolean, default: false },
    lateMinutes: { type: Number, default: 0 },
    reason: { type: String },
    remarks: { type: String },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    markedByName: { type: String },
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    editedPunchTime: { type: String },
    contactRequested: { type: Boolean, default: false },
    contactApproved: { type: Boolean, default: false },
    editHistory: [
      {
        editedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        editedByName: { type: String },
        oldStatus: { type: String },
        newStatus: { type: String },
        reason: { type: String },
        editedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, dateKey: 1 }, { unique: true });

// ✅ FIX: Remove 'next' parameter - use async or regular function without 'next'
attendanceSchema.pre("save", function() {
  if (!this.date && this.dateKey) {
    this.date = this.dateKey;
  }
});

module.exports = mongoose.model("Attendance", attendanceSchema);