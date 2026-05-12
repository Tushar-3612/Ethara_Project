const express = require("express");
const Activity = require("../models/Activity");
const Task = require("../models/Task");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/", authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10) || 20, 50);

    if (req.user.role === "admin") {
      const activities = await Activity.find({})
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("actor", "name email role")
        .populate("project", "title")
        .populate("task", "title status priority deadline assignedTo");
      return res.json(activities);
    }

    const myTaskIds = await Task.find({ assignedTo: req.user._id }).distinct("_id");
    const myProjectIds = await Project.find({
      $or: [{ createdBy: req.user._id }, { members: req.user._id }],
    }).distinct("_id");

    const activities = await Activity.find({
      $or: [{ actor: req.user._id }, { task: { $in: myTaskIds } }, { project: { $in: myProjectIds } }],
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "name email role")
      .populate("project", "title")
      .populate("task", "title status priority deadline assignedTo");

    return res.json(activities);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch activities", error: error.message });
  }
});

module.exports = router;

