const express = require("express");
const User = require("../models/User");
const Task = require("../models/Task");
const Project = require("../models/Project");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Attendance = require("../models/Attendance");
const LeaveRequest = require("../models/LeaveRequest");
const Activity = require("../models/Activity");

const router = express.Router();

// Get all members (Admin only)
router.get("/", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const users = await User.find({ role: "member" })
      .sort({ createdAt: -1 })
      .select("_id name email role batch rating completedTasks completedProjects createdAt lastActive isActive");
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

// Get all guides/leads (Admin only)
router.get("/guides", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const guides = await User.find({ role: "guide" })
      .sort({ createdAt: -1 })
      .select("_id name email role guideType assignedBatch batch canEditAttendance createdAt");
    return res.json(guides);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch guides", error: error.message });
  }
});

// Remove member or guide (Admin only)
router.delete("/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.role === "admin") return res.status(400).json({ message: "Admin user cannot be removed" });

    await Task.deleteMany({ assignedTo: user._id });
    await Project.updateMany({ members: user._id }, { $pull: { members: user._id } });
    if (user.role === "guide") {
      await Project.updateMany({ guide: user._id }, { $set: { guide: null } });
    }
    await User.deleteOne({ _id: user._id });
    return res.json({ message: "User removed", id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: "Failed to remove user", error: error.message });
  }
});

// Get guide's batch users
router.get("/guide/batch-users", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const guide = await User.findById(req.user._id);
    if (!guide.assignedBatch && !guide.batch) {
      return res.status(400).json({ message: "No batch assigned to you" });
    }
    
    const batchName = guide.assignedBatch || guide.batch;
    const users = await User.find({ batch: batchName, role: "member" })
      .select("_id name email batch rating completedTasks completedProjects lastActive isActive");
    
    return res.json({ batch: batchName, users });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch batch users", error: error.message });
  }
});

// Admin batch report
router.get("/reports/batches", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const members = await User.find({ role: "member", batch: { $ne: "" } })
      .select("_id batch completedProjects")
      .lean();

    const byBatch = new Map();
    members.forEach((m) => {
      if (!byBatch.has(m.batch)) {
        byBatch.set(m.batch, {
          batch: m.batch,
          totalStudents: 0,
          completedProjects: 0,
          attendancePct: 0,
          totalLeaves: 0,
          approvedLeaves: 0,
          pendingLeaves: 0,
        });
      }
      const row = byBatch.get(m.batch);
      row.totalStudents += 1;
      row.completedProjects += m.completedProjects || 0;
    });

    const memberIds = members.map((m) => m._id);
    const attendance = await Attendance.find({ user: { $in: memberIds } })
      .select("user status")
      .lean();
    const leaves = await LeaveRequest.find({ user: { $in: memberIds } })
      .select("user status")
      .lean();

    const userToBatch = new Map(members.map((m) => [String(m._id), m.batch]));
    const attStats = {};
    attendance.forEach((a) => {
      const batch = userToBatch.get(String(a.user));
      if (!batch) return;
      if (!attStats[batch]) attStats[batch] = { good: 0, total: 0 };
      attStats[batch].total += 1;
      if (a.status === "present" || a.status === "late") attStats[batch].good += 1;
    });

    leaves.forEach((l) => {
      const batch = userToBatch.get(String(l.user));
      if (!batch || !byBatch.has(batch)) return;
      const row = byBatch.get(batch);
      row.totalLeaves += 1;
      if (l.status === "approved") row.approvedLeaves += 1;
      if (l.status === "pending") row.pendingLeaves += 1;
    });

    for (const [batch, row] of byBatch.entries()) {
      const stat = attStats[batch] || { good: 0, total: 0 };
      row.attendancePct = stat.total ? Math.round((stat.good / stat.total) * 100) : 0;
    }

    return res.json(
      Array.from(byBatch.values()).sort((a, b) => a.batch.localeCompare(b.batch))
    );
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch batch report", error: error.message });
  }
});

// Update user active status
router.put("/me/active-status", authMiddleware, async (req, res) => {
  try {
    const { isActive } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { isActive: isActive || false, lastActive: new Date() },
      { new: true }
    ).select("_id name isActive lastActive");
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update status", error: error.message });
  }
});

// Get user profile with details (Admin only)
router.get("/:id/profile", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("_id name email role batch rating completedTasks completedProjects createdAt");
    if (!user) return res.status(404).json({ message: "User not found" });

    const tasks = await Task.find({ assignedTo: user._id }).select("_id title status projectId createdAt completedAt deadline");
    const completedTasks = tasks.filter((t) => t.status === "completed");
    const projectIds = [...new Set(tasks.map((t) => t.projectId.toString()))];
    const projects = await Project.find({ _id: { $in: projectIds } }).select("_id title createdAt completedAt difficulty guide supportRole targetBatches");

    const completedProjectIds = new Set(
      projects
        .filter((p) => p.completedAt)
        .map((p) => p._id.toString())
    );

    const avgProjectDays = projects.length
      ? Math.round(
          (projects
            .filter((p) => p.completedAt)
            .reduce((acc, p) => acc + Math.max(0, (new Date(p.completedAt).getTime() - new Date(p.createdAt).getTime()) / 86400000), 0) /
            Math.max(1, projects.filter((p) => p.completedAt).length)) * 10
        ) / 10
      : 0;

    const Attendance = require("../models/Attendance");
    const attendance = await Attendance.find({ user: user._id }).sort({ dateKey: -1 }).limit(60);
    const presentDays = attendance.filter((a) => a.status === "present").length;
    const lateDays = attendance.filter((a) => a.status === "late").length;
    const absentDays = attendance.filter((a) => a.status === "absent").length;
    const attendancePct = attendance.length ? Math.round(((presentDays + lateDays) / attendance.length) * 100) : 0;
    const totalMinutes = attendance.reduce((acc, a) => acc + (a.totalMinutes || 0), 0);
    
    // Calculate performance stars
    let stars = 1;
    if (completedTasks.length >= 20 && attendancePct >= 90) stars = 5;
    else if (completedTasks.length >= 15 && attendancePct >= 85) stars = 4;
    else if (completedTasks.length >= 10 && attendancePct >= 80) stars = 3;
    else if (completedTasks.length >= 5) stars = 2;

    return res.json({
      user: { ...user.toObject(), stars },
      stats: {
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        totalProjectsTouched: projects.length,
        completedProjects: completedProjectIds.size,
        avgProjectDays,
        attendancePct,
        totalWorkHours: Math.round((totalMinutes / 60) * 10) / 10,
        presentDays,
        lateDays,
        absentDays,
      },
      projects,
      tasks: tasks.slice(0, 200),
      attendance: attendance.slice(0, 30),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile", error: error.message });
  }
});

// My profile card metrics
router.get("/me/profile-card", authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select(
      "_id name email role batch rating stars completedTasks completedProjects createdAt"
    );
    if (!me) return res.status(404).json({ message: "User not found" });

    const myProjects = await Project.find({
      $or: [{ members: req.user._id }, { targetBatches: me.batch }],
    }).select("_id createdAt completedAt");
    const totalProjects = myProjects.length;
    const completedProjects = myProjects.filter((p) => p.completedAt).length;
    const pendingProjects = Math.max(0, totalProjects - completedProjects);

    const completedDurations = myProjects
      .filter((p) => p.completedAt)
      .map((p) =>
        Math.max(0, (new Date(p.completedAt).getTime() - new Date(p.createdAt).getTime()) / 86400000)
      );
    const avgCompletionTimeDays = completedDurations.length
      ? Math.round(
          (completedDurations.reduce((sum, d) => sum + d, 0) / completedDurations.length) * 10
        ) / 10
      : 0;

    const daysSinceCreated = Math.max(
      1,
      Math.ceil((Date.now() - new Date(me.createdAt).getTime()) / 86400000)
    );
    const avgProjectsPerDay = Math.round((completedProjects / daysSinceCreated) * 100) / 100;

    const attendance = await Attendance.find({ user: req.user._id }).select("status").lean();
    const attendancePct = attendance.length
      ? Math.round(
          (attendance.filter((a) => a.status === "present" || a.status === "late").length /
            attendance.length) *
            100
        )
      : 0;

    const activities = await Activity.find({ actor: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("type message createdAt")
      .lean();

    return res.json({
      profile: me,
      metrics: {
        totalProjects,
        completedProjects,
        pendingProjects,
        avgCompletionTimeDays,
        avgProjectsPerDay,
        attendancePct,
      },
      activities,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch profile card", error: error.message });
  }
});

// Update user rating (Admin only)
router.put("/:id/rating", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const rating = Number(req.body.rating);
    if (![1, 2, 3, 4, 5].includes(rating)) {
      return res.status(400).json({ message: "Rating must be between 1 and 5" });
    }
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: "member" },
      { rating },
      { new: true }
    ).select("_id name email role rating completedTasks completedProjects");
    if (!user) return res.status(404).json({ message: "Member not found" });
    return res.json(user);
  } catch (error) {
    return res.status(500).json({ message: "Failed to update rating", error: error.message });
  }
});

// Get performance data (Admin only)
router.get("/performance", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const members = await User.find({ role: "member" }).select("_id name email rating completedTasks completedProjects batch");
    const memberIds = members.map((m) => m._id);
    const tasks = await Task.find({ assignedTo: { $in: memberIds } }).select("assignedTo status");
    const taskStats = tasks.reduce((acc, task) => {
      const key = task.assignedTo.toString();
      if (!acc[key]) acc[key] = { totalTasks: 0, completedTasks: 0 };
      acc[key].totalTasks += 1;
      if (task.status === "completed") acc[key].completedTasks += 1;
      return acc;
    }, {});

    const data = members.map((m) => {
      const stats = taskStats[m._id.toString()] || { totalTasks: 0, completedTasks: 0 };
      const score = stats.completedTasks * 2 + (m.rating || 3);
      return {
        ...m.toObject(),
        totalTasks: stats.totalTasks,
        completedTasks: stats.completedTasks,
        score,
      };
    });
    data.sort((a, b) => b.score - a.score);
    return res.json({
      bestMember: data[0] || null,
      members: data,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch performance", error: error.message });
  }
});

// Get user achievements (for logged in user)
router.get("/me/achievements", authMiddleware, async (req, res) => {
  try {
    const me = await User.findById(req.user._id).select("_id name email role rating completedTasks completedProjects");
    if (!me) return res.status(404).json({ message: "User not found" });

    const tasks = await Task.find({ assignedTo: req.user._id }).select("status");
    const completedTasks = tasks.filter((t) => t.status === "completed").length;

    const projects = await Project.find({ members: req.user._id }).select("_id");
    const projectIds = projects.map((p) => p._id);
    const projectTasks = await Task.find({ projectId: { $in: projectIds } }).select("projectId status");
    const completedProjectIds = new Set(
      projectIds.filter((pid) => {
        const list = projectTasks.filter((t) => t.projectId.toString() === pid.toString());
        return list.length > 0 && list.every((t) => t.status === "completed");
      }).map((x) => x.toString())
    );

    const Attendance = require("../models/Attendance");
    const attendances = await Attendance.find({ user: req.user._id });
    const attendancePct = attendances.length 
      ? Math.round((attendances.filter(a => a.status === "present" || a.status === "late").length / attendances.length) * 100) 
      : 0;

    const badges = [];
    if (me.rating >= 4.8 || completedTasks >= 20) badges.push("🏆 Top Performer");
    if (completedTasks >= 15) badges.push("⚡ Fast Worker");
    if (completedTasks >= 10 && me.rating >= 4) badges.push("🌟 Consistent Contributor");
    if (attendancePct >= 95) badges.push("🎯 Perfect Attendance");
    if (completedProjectIds.size >= 5) badges.push("🚀 Project Master");

    return res.json({
      user: me,
      completedTasks,
      completedProjects: completedProjectIds.size,
      attendancePct,
      badges,
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch achievements", error: error.message });
  }
});

// Batch management - Get all batches (Admin only)
router.get("/batches", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const batches = await User.aggregate([
      { $match: { role: "member" } },
      { $group: { _id: "$batch", count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    return res.json(batches.filter(b => b._id && b._id !== ""));
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch batches", error: error.message });
  }
});

// Get users by batch (Admin only)
router.get("/batch/:batchName", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const users = await User.find({ batch: req.params.batchName, role: "member" })
      .select("_id name email rating completedTasks completedProjects");
    return res.json(users);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch batch users", error: error.message });
  }
});

// GET / route ko replace kar with this:

router.get("/", authMiddleware, async (req, res) => {
  try {
    console.log("Fetching projects for user:", req.user?._id, "Role:", req.user?.role);
    
    let query = {};
    
    // If user is not admin, show only their batch projects
    if (req.user.role !== "admin" && req.user.batch) {
      query = {
        $or: [
          { targetBatches: req.user.batch },
          { members: req.user._id }
        ]
      };
      console.log("Query for non-admin:", query);
    }
    
    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role")
      .populate("members", "name email role")
      .populate("guide", "name email role")
      .populate("supportRole.user", "name email role");

    console.log("Projects found:", projects.length);
    
    const projectIds = projects.map((p) => p._id);
    const tasks = await Task.find({ projectId: { $in: projectIds } }).select("projectId status assignedTo");
    
    const statsMap = tasks.reduce((acc, task) => {
      const key = task.projectId.toString();
      if (!acc[key]) acc[key] = { totalTasks: 0, completedTasks: 0, userCompleted: {} };
      acc[key].totalTasks += 1;
      if (task.status === "completed") {
        acc[key].completedTasks += 1;
        const userId = task.assignedTo?.toString();
        if (userId) {
          acc[key].userCompleted[userId] = (acc[key].userCompleted[userId] || 0) + 1;
        }
      }
      return acc;
    }, {});

    const enhanced = projects.map((project) => {
      const stats = statsMap[project._id.toString()] || { totalTasks: 0, completedTasks: 0, progress: 0 };
      const progress = stats.totalTasks ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
      const userProgress = stats.userCompleted?.[req.user._id.toString()] || 0;
      
      return {
        ...project.toObject(),
        stats: { ...stats, progress, userProgress },
        isCompleted: stats.totalTasks > 0 && stats.completedTasks === stats.totalTasks,
      };
    });

    return res.json(enhanced);
  } catch (error) {
    console.error("Projects API error:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({ message: "Failed to fetch projects", error: error.message, stack: error.stack });
  }
});
module.exports = router;