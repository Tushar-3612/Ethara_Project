const express = require("express");
const WorkLog = require("../models/WorkLog");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

const pad2 = (n) => String(n).padStart(2, "0");
const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const list = await WorkLog.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch work logs", error: error.message });
  }
});

router.post("/", authMiddleware, async (req, res) => {
  try {
    const { text, completedTaskIds = [] } = req.body || {};
    if (!text) return res.status(400).json({ message: "text is required" });
    const dateKey = toDateKey(new Date());
    const created = await WorkLog.create({
      user: req.user._id,
      dateKey,
      text,
      completedTaskIds: Array.isArray(completedTaskIds) ? completedTaskIds.filter(Boolean) : [],
    });
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: "Failed to submit work log", error: error.message });
  }
});

router.get("/admin", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "50", 10) || 50, 200);
    const list = await WorkLog.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("user", "_id name email role");
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch logs", error: error.message });
  }
});

module.exports = router;

