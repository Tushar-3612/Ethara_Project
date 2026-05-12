const express = require("express");
const Task = require("../models/Task");
const Project = require("../models/Project");
const Activity = require("../models/Activity");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

router.post("/", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { title, description, projectId, assignedTo, status, deadline, priority } = req.body;
    if (!title || !projectId || !assignedTo || !deadline) {
      return res
        .status(400)
        .json({ message: "title, projectId, assignedTo, and deadline are required" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const assignee = await User.findById(assignedTo);
    if (!assignee) return res.status(400).json({ message: "Assigned user not found" });
    if (assignee.role !== "member") return res.status(400).json({ message: "Tasks can only be assigned to members" });

    if (!project.members.some((m) => m.toString() === assignee._id.toString())) {
      project.members.push(assignee._id);
      await project.save();
    }

    const task = await Task.create({
      title,
      description,
      projectId,
      assignedTo,
      status: status || "pending",
      priority: priority || "medium",
      deadline,
    });

    await Activity.create({
      type: "task_assigned",
      actor: req.user._id,
      project: project._id,
      task: task._id,
      message: `Task assigned: ${title}`,
      meta: { assignedTo },
    });

    const populatedTask = await Task.findById(task._id)
      .populate("projectId", "title description")
      .populate("assignedTo", "name email role");

    return res.status(201).json(populatedTask);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create task", error: error.message });
  }
});

router.get("/", authMiddleware, async (req, res) => {
  try {
    const { status, project, user, search } = req.query;
    const filter = req.user.role === "admin" ? {} : { assignedTo: req.user._id };
    if (status && ["pending", "in-progress", "completed", "blocked"].includes(status)) {
      filter.status = status;
    }
    if (project) filter.projectId = project;
    if (req.user.role === "admin" && user) filter.assignedTo = user;
    if (search) filter.title = { $regex: search, $options: "i" };

    const tasks = await Task.find(filter)
      .sort({ createdAt: -1 })
      .populate("projectId", "title description")
      .populate("assignedTo", "name email role");

    return res.json(tasks);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch tasks", error: error.message });
  }
});

router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "in-progress", "completed", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (req.user.role !== "admin" && task.assignedTo.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Forbidden: not your task" });
    }

    task.status = status;
    const wasCompleted = task.status === "completed";
    if (status === "completed") task.completedAt = new Date();
    if (status !== "completed") task.completedAt = null;
    await task.save();

    if (!wasCompleted && status === "completed") {
      await User.findByIdAndUpdate(task.assignedTo, { $inc: { completedTasks: 1 } });
    }

    const type = status === "completed" ? "task_completed" : "task_status_updated";
    await Activity.create({
      type,
      actor: req.user._id,
      project: task.projectId,
      task: task._id,
      message: `Task status updated: ${task.title} → ${status}`,
      meta: { status },
    });

    const populatedTask = await Task.findById(task._id)
      .populate("projectId", "title description")
      .populate("assignedTo", "name email role");

    return res.json(populatedTask);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update task", error: error.message });
  }
});

module.exports = router;
