const express = require("express");
const LeaveRequest = require("../models/LeaveRequest");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

// User: Apply for leave
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { dateKey, reason } = req.body || {};
    if (!dateKey || !reason) {
      return res.status(400).json({ message: "dateKey and reason are required" });
    }
    
    const created = await LeaveRequest.create({ 
      user: req.user._id, 
      dateKey, 
      reason, 
      status: "pending" 
    });
    
    return res.status(201).json(created);
  } catch (error) {
    return res.status(500).json({ message: "Failed to request leave", error: error.message });
  }
});

// User: Get my leave requests
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const list = await LeaveRequest.find({ user: req.user._id }).sort({ createdAt: -1 });
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch leave requests", error: error.message });
  }
});

// Admin: Get all leave requests
router.get("/admin", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const list = await LeaveRequest.find({})
      .sort({ createdAt: -1 })
      .populate("user", "_id name email role");
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch leave requests", error: error.message });
  }
});

// Guide: Get leave requests from their batch members
router.get("/guide/batch", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    if (!req.user.assignedBatch) {
      return res.json([]);
    }
    
    const batchUsers = await User.find({ 
      role: "member", 
      batch: req.user.assignedBatch 
    }).select("_id");
    
    const userIds = batchUsers.map((u) => u._id);
    
    const list = await LeaveRequest.find({ user: { $in: userIds } })
      .sort({ createdAt: -1 })
      .populate("user", "_id name email role batch");
    
    return res.json(list);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch batch leave requests", error: error.message });
  }
});

// Update leave request status (Admin or Guide)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body || {};
    
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    
    const leaveRequest = await LeaveRequest.findById(req.params.id);
    if (!leaveRequest) {
      return res.status(404).json({ message: "Leave request not found" });
    }
    
    // Check authorization
    if (req.user.role !== "admin") {
      const user = await User.findById(leaveRequest.user);
      if (req.user.assignedBatch !== user?.batch) {
        return res.status(403).json({ message: "Not authorized to review this leave request" });
      }
    }
    
    const updated = await LeaveRequest.findByIdAndUpdate(
      req.params.id,
      { status, reviewedBy: req.user._id, reviewedAt: new Date() },
      { new: true }
    ).populate("user", "_id name email role");
    
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update leave request", error: error.message });
  }
});

module.exports = router;