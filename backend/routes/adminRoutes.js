const express = require("express");
const mongoose = require("mongoose");
const User = require("../models/User");
const Project = require("../models/Project");
const Requirement = require("../models/Requirement");
const Task = require("../models/Task");
const Batch = require("../models/Batch");
const Attendance = require("../models/Attendance");
const Activity = require("../models/Activity");
const adminMiddleware = require("../middleware/adminMiddleware");

const router = express.Router();
router.use(...adminMiddleware);

function starsFromCompletionPct(pct) {
  const n = Number(pct) || 0;
  if (n >= 90) return 5;
  if (n >= 75) return 4;
  if (n >= 60) return 3;
  if (n >= 40) return 2;
  return 1;
}

async function guideCompletionMetrics(guideId) {
  const projects = await Project.find({ guide: guideId }).select("_id").lean();
  const pids = projects.map((p) => p._id);
  if (!pids.length) {
    return { completionRatePct: 0, totalTasks: 0, completedTasks: 0, projectsCount: 0 };
  }
  const [total, done] = await Promise.all([
    Task.countDocuments({ projectId: { $in: pids }, requirementId: { $ne: null } }),
    Task.countDocuments({
      projectId: { $in: pids },
      requirementId: { $ne: null },
      status: "completed",
    }),
  ]);
  const completionRatePct = total ? Math.round((done / total) * 1000) / 10 : 0;
  return {
    completionRatePct,
    totalTasks: total,
    completedTasks: done,
    projectsCount: pids.length,
  };
}

async function attendancePctForUser(userId) {
  const n = await Attendance.countDocuments({ user: userId });
  if (!n) return 0;
  const present = await Attendance.countDocuments({
    user: userId,
    status: { $in: ["present", "late", "half-day"] },
  });
  return Math.round((present / n) * 1000) / 10;
}

async function studentTaskCompletionPct(userId) {
  const total = await Task.countDocuments({ assignedTo: userId, requirementId: { $ne: null } });
  if (!total) return 0;
  const done = await Task.countDocuments({
    assignedTo: userId,
    requirementId: { $ne: null },
    status: "completed",
  });
  return Math.round((done / total) * 1000) / 10;
}

// GET /api/admin/stats
router.get("/stats", async (req, res) => {
  try {
    const [guides, students, projects, requirementCount] = await Promise.all([
      User.countDocuments({ role: "guide", isActive: true }),
      User.countDocuments({ role: "member", isActive: true }),
      Project.countDocuments(),
      Requirement.countDocuments(),
    ]);

    const reqCompleted = await Requirement.countDocuments({ status: "completed" });
    const avgCompletionRate =
      requirementCount > 0 ? Math.round((reqCompleted / requirementCount) * 1000) / 10 : 0;

    res.json({
      guides,
      students,
      projects,
      requirements: requirementCount,
      avgCompletionRate,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/admin/guides
router.get("/guides", async (req, res) => {
  try {
    const guides = await User.find({ role: "guide" })
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    const out = await Promise.all(
      guides.map(async (g) => {
        const metrics = await guideCompletionMetrics(g._id);
        const studentsInBatch = await User.countDocuments({
          role: "member",
          batch: g.assignedBatch || g.batch,
          isActive: true,
        });
        const stars = starsFromCompletionPct(metrics.completionRatePct);
        const attendanceAvgPct =
          studentsInBatch > 0
            ? await (async () => {
                const members = await User.find({
                  role: "member",
                  batch: g.assignedBatch || g.batch,
                })
                  .select("_id")
                  .lean();
                if (!members.length) return 0;
                const pcts = await Promise.all(members.map((m) => attendancePctForUser(m._id)));
                const sum = pcts.reduce((a, b) => a + b, 0);
                return Math.round((sum / pcts.length) * 10) / 10;
              })()
            : 0;

        return {
          ...g,
          performanceMetrics: {
            ...metrics,
            studentsCount: studentsInBatch,
            attendanceAvgPct,
          },
          stars,
        };
      })
    );

    res.json(out);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/admin/students
router.get("/students", async (req, res) => {
  try {
    const members = await User.find({ role: "member" })
      .select("-password")
      .sort({ batch: 1, name: 1 })
      .lean();

    const guides = await User.find({ role: "guide" }).select("_id name assignedBatch batch").lean();
    const guideByBatch = {};
    guides.forEach((g) => {
      const b = g.assignedBatch || g.batch;
      if (b) guideByBatch[b] = { _id: g._id, name: g.name, assignedBatch: b };
    });

    const enriched = await Promise.all(
      members.map(async (m) => {
        const completionPct = await studentTaskCompletionPct(m._id);
        const attendancePct = await attendancePctForUser(m._id);
        const assignedGuide = guideByBatch[m.batch] || null;
        return {
          ...m,
          completionPct,
          attendancePct,
          assignedGuide,
        };
      })
    );

    const grouped = {};
    enriched.forEach((s) => {
      const key = s.assignedGuide?.name || s.batch || "Unassigned";
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    res.json({ students: enriched, grouped });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/admin/kick-user/:id
router.put("/kick-user/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: "User not found" });
    if (u.role === "admin") return res.status(400).json({ message: "Cannot deactivate admin" });

    u.isActive = false;
    u.kickedAt = new Date();
    await u.save();

    await Activity.create({
      type: "user_kicked",
      actor: req.user._id,
      message: `User deactivated: ${u.email}`,
      meta: { targetId: u._id },
    }).catch(() => {});

    res.json({ message: "User deactivated", id: u._id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/admin/restore-user/:id
router.put("/restore-user/:id", async (req, res) => {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ message: "User not found" });

    u.isActive = true;
    u.kickedAt = null;
    await u.save();

    await Activity.create({
      type: "user_restored",
      actor: req.user._id,
      message: `User restored: ${u.email}`,
      meta: { targetId: u._id },
    }).catch(() => {});

    res.json({ message: "User restored", id: u._id });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/admin/students/:id/reassign
router.put("/students/:id/reassign", async (req, res) => {
  try {
    const { guideId } = req.body || {};
    if (!guideId || !mongoose.Types.ObjectId.isValid(guideId)) {
      return res.status(400).json({ message: "guideId required" });
    }
    const student = await User.findOne({ _id: req.params.id, role: "member" });
    if (!student) return res.status(404).json({ message: "Student not found" });
    const guide = await User.findOne({ _id: guideId, role: "guide" });
    if (!guide) return res.status(404).json({ message: "Guide not found" });

    const batch = guide.assignedBatch || guide.batch || "";
    if (!batch) return res.status(400).json({ message: "Guide has no assigned batch" });

    student.batch = batch;
    await student.save();

    res.json({ message: "Student reassigned", student });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/admin/projects
router.get("/projects", async (req, res) => {
  try {
    const { guide, batch, adminApproval } = req.query;
    const filter = {};
    if (guide && mongoose.Types.ObjectId.isValid(guide)) filter.guide = guide;
    if (batch) filter.targetBatches = batch;
    if (adminApproval && ["pending", "approved", "rejected"].includes(adminApproval)) {
      filter.adminApproval = adminApproval;
    }

    const projects = await Project.find(filter)
      .populate("guide", "name email assignedBatch")
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json(projects);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/admin/projects/:projectId/approval
router.put("/projects/:projectId/approval", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["pending", "approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "status must be pending, approved, or rejected" });
    }
    const p = await Project.findByIdAndUpdate(
      req.params.projectId,
      { adminApproval: status },
      { new: true }
    )
      .populate("guide", "name email")
      .lean();

    if (!p) return res.status(404).json({ message: "Project not found" });
    res.json(p);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /api/admin/top-performers
router.get("/top-performers", async (req, res) => {
  try {
    const guides = await User.find({ role: "guide", isActive: true }).select("-password").lean();
    const guideRows = await Promise.all(
      guides.map(async (g) => {
        const metrics = await guideCompletionMetrics(g._id);
        const stars = starsFromCompletionPct(metrics.completionRatePct);
        return { ...g, metrics, stars };
      })
    );
    guideRows.sort((a, b) => b.stars - a.stars || b.metrics.completionRatePct - a.metrics.completionRatePct);
    const topGuides = guideRows.slice(0, 5);

    const members = await User.find({ role: "member", isActive: true }).select("-password").lean();
    const memberRows = await Promise.all(
      members.map(async (m) => ({
        ...m,
        completionPct: await studentTaskCompletionPct(m._id),
        attendancePct: await attendancePctForUser(m._id),
      }))
    );
    memberRows.sort((a, b) => b.completionPct - a.completionPct || b.completedTasks - a.completedTasks);
    const topStudents = memberRows.slice(0, 10);

    res.json({ topGuides, topStudents });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// —— Batch management ——
router.get("/batches", async (req, res) => {
  try {
    const batches = await Batch.find({})
      .populate("guide", "name email assignedBatch")
      .sort({ name: 1 })
      .lean();
    res.json(batches);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/batches", async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ message: "Batch name required" });
    const b = await Batch.create({ name: String(name).trim() });
    res.status(201).json(b);
  } catch (e) {
    if (e.code === 11000) return res.status(400).json({ message: "Batch name already exists" });
    res.status(500).json({ message: e.message });
  }
});

router.put("/batches/:id", async (req, res) => {
  try {
    const { name, guide } = req.body || {};
    const update = {};
    if (name) update.name = String(name).trim();
    if (guide !== undefined) {
      update.guide = guide && mongoose.Types.ObjectId.isValid(guide) ? guide : null;
    }
    const b = await Batch.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate("guide", "name email")
      .lean();
    if (!b) return res.status(404).json({ message: "Batch not found" });
    res.json(b);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.delete("/batches/:id", async (req, res) => {
  try {
    const b = await Batch.findByIdAndDelete(req.params.id);
    if (!b) return res.status(404).json({ message: "Batch not found" });
    res.json({ message: "Batch deleted" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PUT /api/admin/guides/:id — edit guide batch assignment
router.put("/guides/:id", async (req, res) => {
  try {
    const { assignedBatch } = req.body || {};
    const g = await User.findOne({ _id: req.params.id, role: "guide" });
    if (!g) return res.status(404).json({ message: "Guide not found" });
    if (assignedBatch !== undefined) {
      const b = String(assignedBatch).trim();
      g.assignedBatch = b;
      g.batch = b;
    }
    await g.save();
    res.json(g);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.put("/batches/:id/assign-guide", async (req, res) => {
  try {
    const { guideId } = req.body || {};
    if (!guideId || !mongoose.Types.ObjectId.isValid(guideId)) {
      return res.status(400).json({ message: "guideId required" });
    }
    const guide = await User.findOne({ _id: guideId, role: "guide" });
    if (!guide) return res.status(404).json({ message: "Guide not found" });

    const batch = await Batch.findByIdAndUpdate(
      req.params.id,
      { guide: guideId },
      { new: true }
    )
      .populate("guide", "name email assignedBatch")
      .lean();

    if (!batch) return res.status(404).json({ message: "Batch not found" });

    const batchName = batch.name;
    guide.assignedBatch = batchName;
    guide.batch = batchName;
    await guide.save();

    res.json({ batch, guide });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
