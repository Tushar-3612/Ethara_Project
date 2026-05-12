const express = require("express");
const mongoose = require("mongoose");
const Project = require("../models/Project");
const Activity = require("../models/Activity");
const User = require("../models/User");
const Task = require("../models/Task");
const Requirement = require("../models/Requirement");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();
const normalizeBatches = (arr = []) => [...new Set(arr.filter(Boolean).map((b) => String(b).trim()))];

const parseHHmmToMinutes = (s) => {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
};

const localMinutesNow = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};

const memberMayMarkProjectComplete = (project) => {
  const deadlineDate = project.deadline ? new Date(project.deadline) : null;
  const hasCal = Boolean(deadlineDate) && !Number.isNaN(deadlineDate.getTime());
  if (hasCal) {
    return Date.now() >= deadlineDate.getTime();
  }
  const endMin = parseHHmmToMinutes(project.workEndTime || "");
  if (endMin != null) {
    return localMinutesNow() >= endMin;
  }
  return true;
};

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

const getDeadlineMeta = (project) => {
  if (!project?.deadline) {
    return { isDeadlinePassed: false, remainingTime: null };
  }
  const deadlineMs = new Date(project.deadline).getTime();
  if (Number.isNaN(deadlineMs)) {
    return { isDeadlinePassed: false, remainingTime: null };
  }
  const leftMs = deadlineMs - Date.now();
  return {
    isDeadlinePassed: leftMs <= 0,
    remainingTime: leftMs > 0 ? formatRemainingTime(leftMs) : "0m",
  };
};

const getActiveProjectCount = async (userId) => {
  const activeTasks = await Task.find({
    assignedTo: userId,
    status: { $in: ["pending", "in-progress"] }
  }).distinct("projectId");
  return activeTasks.length;
};

/** Only requirement-linked tasks count toward “all requirements done” progress. */
const hasCompletedAllProjectTasks = async (projectId, userId) => {
  const [totalTasks, completedTasks] = await Promise.all([
    Task.countDocuments({ projectId, assignedTo: userId, requirementId: { $ne: null } }),
    Task.countDocuments({
      projectId,
      assignedTo: userId,
      requirementId: { $ne: null },
      status: "completed",
    }),
  ]);
  return totalTasks > 0 && completedTasks === totalTasks;
};

/** Requirements from Requirement collection, else legacy embedded subdocs */
async function listRequirementsForProjectTasks(project) {
  const coll = await Requirement.find({ project: project._id }).sort({ createdAt: 1 }).lean();
  if (coll.length) return coll;
  return (project.requirements || []).map((r) => {
    const o = r.toObject ? r.toObject() : r;
    return {
      ...o,
      _id: r._id,
      timeLimitMinutes:
        (o.timeLimitHours || 0) * 60 + (o.timeLimitMinutes || 0) + Math.ceil((o.timeLimitSeconds || 0) / 60),
    };
  });
}

async function totalRequirementCountForProject(project) {
  const n = await Requirement.countDocuments({ project: project._id });
  if (n > 0) return n;
  return project.requirements?.length || 0;
}

// Create project (Admin only)
router.post("/", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const {
      title,
      description,
      members = [],
      difficulty,
      platform,
      priority,
      guide,
      supportRole,
      targetBatches = [],
      deadline,
      workStartTime,
      workEndTime,
      completionTargetCount,
      batchApprovalRequired,
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: "Project title is required" });
    }

    const requestedIds = Array.isArray(members) ? members.filter(Boolean) : [];
    const validIds = await User.find({ _id: { $in: requestedIds } }).distinct("_id");
    const memberUsers = await User.find({ _id: { $in: validIds } }).select("batch").lean();
    const memberBatches = normalizeBatches(memberUsers.map((u) => u.batch));
    const explicitBatches = normalizeBatches(targetBatches);
    const finalTargetBatches = normalizeBatches([...explicitBatches, ...memberBatches]);

    const project = await Project.create({
      title,
      description,
      createdBy: req.user._id,
      members: validIds,
      difficulty: ["basic", "moderate", "hard"].includes(difficulty) ? difficulty : "basic",
      platform: platform || "",
      priority: ["low", "medium", "high"].includes(priority) ? priority : "medium",
      guide: guide || null,
      supportRole: supportRole || undefined,
      targetBatches: finalTargetBatches,
      approvedBatches: batchApprovalRequired === false ? finalTargetBatches : [],
      batchApprovalRequired: batchApprovalRequired !== false,
      deadline: deadline || null,
      workStartTime: workStartTime || "",
      workEndTime: workEndTime || "",
      completionTargetCount: Number.isFinite(Number(completionTargetCount)) && Number(completionTargetCount) > 0 ? Number(completionTargetCount) : 1,
    });

    await Activity.create({
      type: "project_created",
      actor: req.user._id,
      project: project._id,
      message: `Project created: ${title}`,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("createdBy", "name email role")
      .populate("members", "name email role")
      .populate("guide", "name email role")
      .populate("supportRole.user", "name email role");

    return res.status(201).json(populatedProject);
  } catch (error) {
    return res.status(500).json({ message: "Failed to create project", error: error.message });
  }
});

// ✅ START PROJECT
router.post("/:id/start", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    
    const userId = req.user._id;
    const userName = req.user.name;
    
    const existingTasks = await Task.find({ projectId: project._id, assignedTo: userId });
    if (existingTasks.length > 0) {
      return res.status(400).json({ message: "You have already started this project" });
    }
    
    const activeProjectCount = await getActiveProjectCount(userId);
    if (activeProjectCount >= 2) {
      return res.status(400).json({ 
        message: "You can only work on 2 projects at a time."
      });
    }
    
    const isBatchAllowed = (project.targetBatches || []).includes(req.user.batch);
    const isApproved = !project.batchApprovalRequired || (project.approvedBatches || []).includes(req.user.batch);
    
    if (!isBatchAllowed || !isApproved) {
      return res.status(403).json({ message: "This project is not available for your batch yet" });
    }
    
    const requirementRows = await listRequirementsForProjectTasks(project);
    if (requirementRows.length === 0) {
      return res.status(400).json({ message: "No requirements added to this project yet." });
    }

    const deadline = project.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const tasksToCreate = requirementRows.map((req) => ({
      title: req.title,
      description: req.description || "Complete this requirement",
      projectId: project._id,
      assignedTo: userId,
      requirementId: req._id,
      priority: req.priority || project.priority || "medium",
      status: "pending",
      deadline,
      startedAt: null,
      completedRequirements: [],
    }));
    
    const createdTasks = await Task.insertMany(tasksToCreate);
    
    if (!project.members.some(m => m.toString() === userId.toString())) {
      project.members.push(userId);
    }

    const startTs = new Date();
    const msIdx = (project.memberStatuses || []).findIndex(s => s.user.toString() === userId.toString());
    if (msIdx >= 0) {
      project.memberStatuses[msIdx].status = "in-progress";
      project.memberStatuses[msIdx].startedAt = startTs;
      project.memberStatuses[msIdx].completedAt = null;
      project.memberStatuses[msIdx].updatedAt = startTs;
    } else {
      project.memberStatuses.push({
        user: userId,
        status: "in-progress",
        startedAt: startTs,
        completedAt: null,
        updatedAt: startTs,
      });
    }

    await project.save();
    
    await Activity.create({
      type: "project_started",
      actor: userId,
      project: project._id,
      message: `${userName} started working on project: ${project.title}`,
    });
    
    res.json({ success: true, message: "Project started successfully", tasksCount: createdTasks.length });
    
  } catch (error) {
    console.error("Start project error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Get user's pending requirements (with time remaining)
router.get("/:projectId/my-requirements", authMiddleware, async (req, res) => {
  try {
    const { projectId } = req.params;
    const userId = req.user._id;

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    const userCompletedIds = (project.memberStatuses.find((ms) => ms.user.toString() === userId.toString())
      ?.completedRequirements || []
    ).map((id) => id.toString());

    const reqRows = await listRequirementsForProjectTasks(project);
    const tasks = await Task.find({ projectId, assignedTo: userId, requirementId: { $ne: null } }).lean();
    const taskByReq = Object.fromEntries(tasks.map((t) => [String(t.requirementId), t]));

    const pendingRequirements = reqRows
      .filter((r) => !userCompletedIds.includes(r._id.toString()))
      .map((r) => {
        const t = taskByReq[String(r._id)];
        const full = r.toObject?.() || r;
        let limitMin = Number(full.timeLimitMinutes) || 0;
        if ((full.timeLimitHours || 0) > 0 || (full.timeLimitSeconds || 0) > 0) {
          limitMin =
            (full.timeLimitHours || 0) * 60 + (full.timeLimitMinutes || 0) + Math.ceil((full.timeLimitSeconds || 0) / 60);
        }
        let canSubmit = true;
        let remainingTime = "Ready to submit";
        if (t?.status === "in-progress" && limitMin > 0 && t.startedAt) {
          const elapsed = Date.now() - new Date(t.startedAt).getTime();
          const need = limitMin * 60 * 1000;
          const left = need - elapsed;
          if (left > 0) {
            canSubmit = false;
            const leftMin = Math.max(1, Math.ceil(left / 60000));
            remainingTime = `${leftMin} minute(s)`;
          }
        }
        return {
          _id: r._id,
          title: full.title,
          description: full.description,
          priority: full.priority,
          deadline: full.deadline,
          isLocked: !canSubmit,
          remainingTime,
          canSubmit,
        };
      });

    const completedCount = userCompletedIds.length;
    const totalCount = await totalRequirementCountForProject(project);

    res.json({
      projectTitle: project.title,
      totalRequirements: totalCount,
      completedRequirements: completedCount,
      pendingRequirements,
      isComplete: completedCount === totalCount,
    });
  } catch (error) {
    console.error("Get requirements error:", error);
    res.status(500).json({ message: error.message });
  }
});

// ✅ Guide adds requirement with deadline
// Guide adds requirement with deadline
router.post("/:id/requirements", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const { title, description, priority, deadline, timeLimitHours, timeLimitMinutes, timeLimitSeconds } = req.body;

    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Requirement title is required" });
    }

    if (!deadline) {
      return res.status(400).json({ message: "Deadline is required" });
    }

    let requirementDeadline;
    if (typeof deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
      const [y, mo, d] = deadline.split("-").map((n) => parseInt(n, 10));
      requirementDeadline = new Date(y, mo - 1, d, 23, 59, 59, 999);
    } else {
      requirementDeadline = new Date(deadline);
    }

    let minutes = parseInt(req.body.timeLimitMinutes, 10);
    if (!Number.isFinite(minutes)) {
      const h = parseInt(timeLimitHours, 10) || 0;
      const m = parseInt(timeLimitMinutes, 10) || 0;
      const s = parseInt(timeLimitSeconds, 10) || 0;
      minutes = h * 60 + m + Math.ceil(s / 60);
    }
    minutes = Math.max(0, minutes);
    if (minutes <= 0) {
      return res.status(400).json({ message: "Time limit (minutes) must be greater than 0" });
    }

    const requirement = await Requirement.create({
      project: project._id,
      title: title.trim(),
      description: description || "",
      priority: priority || "medium",
      deadline: requirementDeadline,
      timeLimitMinutes: minutes,
      createdBy: req.user._id,
    });

    project.lastRequirementAddedAt = new Date();
    const now = new Date();
    project.memberStatuses.forEach((ms) => {
      if (ms.status !== "completed") {
        ms.status = "pending";
        ms.updatedAt = now;
        ms.currentRequirement = null;
      }
    });
    await project.save();

    const memberIds = (project.members || []).map((m) => m._id || m);
    const taskDeadline = project.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const backfill = [];
    for (const uid of memberIds) {
      const hasAny = await Task.exists({ projectId: project._id, assignedTo: uid });
      if (!hasAny) continue;
      const exists = await Task.exists({ projectId: project._id, assignedTo: uid, requirementId: requirement._id });
      if (!exists) {
        backfill.push({
          title: requirement.title,
          description: requirement.description || "Complete this requirement",
          projectId: project._id,
          assignedTo: uid,
          requirementId: requirement._id,
          priority: requirement.priority || project.priority || "medium",
          status: "pending",
          deadline: taskDeadline,
          startedAt: null,
          completedRequirements: [],
        });
      }
    }
    if (backfill.length) await Task.insertMany(backfill);

    await Activity.create({
      type: "requirements_updated",
      actor: req.user._id,
      project: project._id,
      message: `New requirement added: ${title}`,
    });

    res.status(201).json({
      success: true,
      requirement,
      message: `Requirement added. Deadline: ${requirementDeadline.toLocaleDateString()}, Time limit: ${minutes} minutes`,
    });
  } catch (error) {
    console.error("Add requirement error:", error);
    res.status(500).json({ message: error.message });
  }
});
// Delete project (Admin only)
router.delete("/:id", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    await Task.deleteMany({ projectId: project._id });
    await Activity.deleteMany({ project: project._id });
    await Requirement.deleteMany({ project: project._id });
    await Project.deleteOne({ _id: project._id });

    return res.json({ message: "Project deleted", id: req.params.id });
  } catch (error) {
    return res.status(500).json({ message: "Failed to delete project", error: error.message });
  }
});

// Get all projects
router.get("/", authMiddleware, async (req, res) => {
  try {
    let query = {};
    if (req.user.role === "guide") {
      query = req.user.assignedBatch ? { targetBatches: req.user.assignedBatch } : { guide: req.user._id };
    } else if (req.user.role === "member") {
      query = { $or: [{ members: req.user._id }, { targetBatches: req.user.batch }] };
    }

    let projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role")
      .populate("members", "name email role")
      .populate("guide", "name email role");

    if (req.user.role === "member") {
      projects = projects.filter(p => {
        const isMember = p.members.some(m => m._id.toString() === req.user._id.toString());
        const batchEligible = p.targetBatches.includes(req.user.batch);
        const approved = !p.batchApprovalRequired || p.approvedBatches.includes(req.user.batch);
        return isMember || (batchEligible && approved);
      });
    }

    return res.json(projects);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch projects", error: error.message });
  }
});

// Get projects for guide
router.get("/guide/projects", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const query = req.user.assignedBatch ? { targetBatches: req.user.assignedBatch } : { guide: req.user._id };
    const projects = await Project.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email role")
      .populate("members", "name email role")
      .populate("guide", "name email role")
      .populate("memberStatuses.user", "name email batch role")
      .lean();

    const projectIds = projects.map((p) => p._id);
    const allReqs = await Requirement.find({ project: { $in: projectIds } })
      .sort({ createdAt: 1 })
      .populate("startedBy", "name email")
      .populate("completedBy", "name email")
      .lean();
    const completedTasks = await Task.find({
      projectId: { $in: projectIds },
      requirementId: { $ne: null },
      status: "completed",
    })
      .populate("assignedTo", "name email")
      .lean();

    const completionsByReq = {};
    for (const t of completedTasks) {
      const rid = String(t.requirementId);
      if (!completionsByReq[rid]) completionsByReq[rid] = [];
      completionsByReq[rid].push({
        student: t.assignedTo,
        completedAt: t.completedAt,
      });
    }

    const reqsByProject = {};
    for (const r of allReqs) {
      const pid = String(r.project);
      if (!reqsByProject[pid]) reqsByProject[pid] = [];
      reqsByProject[pid].push({
        ...r,
        studentCompletions: completionsByReq[String(r._id)] || [],
      });
    }

    const out = projects.map((p) => {
      const pid = String(p._id);
      const fromColl = reqsByProject[pid] || [];
      const requirements =
        fromColl.length > 0
          ? fromColl
          : (p.requirements || []).map((er) => ({
              ...er,
              studentCompletions: [],
            }));
      return { ...p, requirements };
    });

    return res.json(out);
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch guide projects", error: error.message });
  }
});

// Member view — requirements merged with this user's tasks (per-student progress)
router.get("/member-view/:id", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id).populate("guide", "name email").lean();
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (req.user.role === "member") {
      const isMember = (project.members || []).some((m) => m.toString() === req.user._id.toString());
      const batchEligible = (project.targetBatches || []).includes(req.user.batch);
      const approved = !project.batchApprovalRequired || (project.approvedBatches || []).includes(req.user.batch);
      if (!isMember && !(batchEligible && approved)) return res.status(403).json({ message: "Forbidden" });
    }

    const myMs = (project.memberStatuses || []).find((s) => String(s.user) === String(req.user._id));
    const deadlineMeta = getDeadlineMeta(project);
    const allTasksCompleted = await hasCompletedAllProjectTasks(project._id, req.user._id);
    const scheduleAllowsComplete = memberMayMarkProjectComplete(project);

    const reqRows = await listRequirementsForProjectTasks(project);
    const tasks = await Task.find({
      projectId: project._id,
      assignedTo: req.user._id,
      requirementId: { $ne: null },
    }).lean();
    const taskByReq = Object.fromEntries(tasks.map((t) => [String(t.requirementId), t]));

    const collReqs = await Requirement.find({ project: project._id })
      .populate("startedBy", "name")
      .populate("completedBy", "name")
      .lean();
    const collById = Object.fromEntries(collReqs.map((x) => [String(x._id), x]));

    const mergedRequirements = reqRows.map((r) => {
      const full = r.toObject?.() || r;
      const coll = collById[String(r._id)];
      const global = coll || full;
      const gStatus = global.status || "pending";
      const startedAt = global.startedAt || null;
      const startedByRaw = global.startedBy;
      const starterId = startedByRaw?._id ? String(startedByRaw._id) : startedByRaw ? String(startedByRaw) : null;

      let limitMin = Number(full.timeLimitMinutes) || 0;
      if ((full.timeLimitHours || 0) > 0 || (full.timeLimitSeconds || 0) > 0) {
        limitMin =
          (full.timeLimitHours || 0) * 60 +
          (full.timeLimitMinutes || 0) +
          Math.ceil((full.timeLimitSeconds || 0) / 60);
      }

      let status = "pending";
      if (gStatus === "completed") status = "completed";
      else if (gStatus === "in-progress") {
        status = starterId === String(req.user._id) ? "in-progress" : "locked";
      }

      const t = taskByReq[String(r._id)];
      if (t?.status === "completed") status = "completed";

      return {
        ...full,
        _id: r._id,
        status,
        startedAt,
        startedBy: starterId,
        startedByName: startedByRaw?.name || null,
        lockedByOther: status === "locked",
        timeLimitMinutes: coll ? coll.timeLimitMinutes : limitMin,
      };
    });

    const totalReqs = await totalRequirementCountForProject(project);

    return res.json({
      _id: project._id,
      title: project.title,
      description: project.description,
      deadline: project.deadline || null,
      requirements: mergedRequirements,
      myProjectStatus: myMs?.status || "pending",
      canMarkComplete: scheduleAllowsComplete && myMs?.status !== "completed" && allTasksCompleted,
      isDeadlinePassed: deadlineMeta.isDeadlinePassed,
      remainingTime: deadlineMeta.remainingTime,
      totalRequirements: totalReqs,
      completedRequirements: myMs?.completedRequirements?.length || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Update task status
router.put("/tasks/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "in-progress", "completed", "blocked"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    if (task.assignedTo.toString() !== req.user._id.toString() && req.user.role !== "admin") {
      return res.status(403).json({ message: "You are not assigned to this task" });
    }

    task.status = status;
    if (status === "completed") {
      task.completedAt = new Date();
      await User.findByIdAndUpdate(task.assignedTo, { $inc: { completedTasks: 1 } });
    }
    
    await task.save();
    return res.json(task);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Member updates project status
router.put("/:id/member-status", authMiddleware, roleMiddleware("member"), async (req, res) => {
  try {
    const { status } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (status === "completed") {
      const total = await totalRequirementCountForProject(project);
      const done =
        project.memberStatuses.find((ms) => ms.user.toString() === req.user._id.toString())?.completedRequirements
          ?.length || 0;
      if (done < total) {
        return res.status(400).json({ message: "Complete all requirements before completing the project" });
      }
    }

    const idx = (project.memberStatuses || []).findIndex(s => s.user.toString() === req.user._id.toString());
    if (idx >= 0) {
      project.memberStatuses[idx].status = status;
      project.memberStatuses[idx].updatedAt = new Date();
      if (status === "completed") project.memberStatuses[idx].completedAt = new Date();
    } else {
      project.memberStatuses.push({ user: req.user._id, status, updatedAt: new Date() });
    }

    await project.save();
    return res.json({ message: "Project status updated", status });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Backward compatible route
router.put("/:id/status", authMiddleware, roleMiddleware("member"), async (req, res) => {
  const { status } = req.body;
  const project = await Project.findById(req.params.id);
  if (!project) return res.status(404).json({ message: "Project not found" });

  const idx = (project.memberStatuses || []).findIndex(s => s.user.toString() === req.user._id.toString());
  if (idx >= 0) {
    project.memberStatuses[idx].status = status;
    project.memberStatuses[idx].updatedAt = new Date();
  } else {
    project.memberStatuses.push({ user: req.user._id, status, updatedAt: new Date() });
  }

  await project.save();
  return res.json({ message: "Status updated", status });
});

// Guide force member status
router.put("/:id/guide/member-status", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const { userId, status } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    const idx = (project.memberStatuses || []).findIndex(s => s.user.toString() === userId.toString());
    if (idx >= 0) {
      project.memberStatuses[idx].status = status;
      project.memberStatuses[idx].updatedAt = new Date();
    } else {
      project.memberStatuses.push({ user: userId, status, updatedAt: new Date() });
    }

    await project.save();
    return res.json({ message: "Status updated by guide", status });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Guide set deadline
router.patch("/:id/guide-meta", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const { deadline } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (deadline) {
      if (typeof deadline === "string" && /^\d{4}-\d{2}-\d{2}$/.test(deadline)) {
        const [y, mo, d] = deadline.split("-").map(n => parseInt(n, 10));
        project.deadline = new Date(y, mo - 1, d, 23, 59, 59, 999);
      } else {
        project.deadline = new Date(deadline);
      }
    }

    await project.save();
    return res.json({ message: "Deadline updated", deadline: project.deadline });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Join project
router.post("/:id/join", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });

    if (!project.members.some(m => m.toString() === req.user._id.toString())) {
      project.members.push(req.user._id);
      await project.save();
    }
    return res.json({ message: "Joined project" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

// Approve batch
router.put("/:id/approve-batch", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: "Project not found" });
    
    if (!project.approvedBatches.includes(req.user.assignedBatch)) {
      project.approvedBatches.push(req.user.assignedBatch);
      await project.save();
    }
    return res.json({ message: "Project approved for batch" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});
module.exports = router;