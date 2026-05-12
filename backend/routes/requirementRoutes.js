const express = require("express");
const Requirement = require("../models/Requirement");
const Project = require("../models/Project");
const Task = require("../models/Task");
const User = require("../models/User");
const Activity = require("../models/Activity");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

const LOCK_MSG = "Already taken by another student";
const COMPLETED_MSG = "This requirement has already been completed.";

async function userCanAccessProject(user, project) {
  if (!project) return false;
  if (user.role === "admin") return true;
  if (user.role === "guide") {
    if (user.assignedBatch && (project.targetBatches || []).includes(user.assignedBatch)) return true;
    if (project.guide && String(project.guide) === String(user._id)) return true;
    return false;
  }
  const isMember = (project.members || []).some((m) => String(m) === String(user._id));
  const batchEligible = (project.targetBatches || []).includes(user.batch);
  const approved = !project.batchApprovalRequired || (project.approvedBatches || []).includes(user.batch);
  return isMember || (batchEligible && approved);
}

/** @returns {{ kind: "collection", requirement: import("mongoose").Document, project: import("mongoose").Document } | { kind: "embedded", project: import("mongoose").Document, sub: import("mongoose").Types.Subdocument } | null } */
async function loadRequirementBundle(requirementId) {
  const reqDoc = await Requirement.findById(requirementId);
  if (reqDoc) {
    const project = await Project.findById(reqDoc.project);
    if (!project) return null;
    return { kind: "collection", requirement: reqDoc, project };
  }
  const project = await Project.findOne({ "requirements._id": requirementId });
  if (!project) return null;
  const sub = project.requirements.id(requirementId);
  if (!sub) return null;
  return { kind: "embedded", project, sub };
}

function embeddedTimeLimitMinutes(sub) {
  const o = sub.toObject ? sub.toObject() : sub;
  return (
    (o.timeLimitHours || 0) * 60 +
    (o.timeLimitMinutes || 0) +
    Math.ceil((o.timeLimitSeconds || 0) / 60)
  );
}

async function ensureStudentTaskForRequirement(userId, project, requirementId, title, description, priority) {
  let task = await Task.findOne({
    projectId: project._id,
    assignedTo: userId,
    requirementId,
  });
  if (task) return task;
  const any = await Task.findOne({ projectId: project._id, assignedTo: userId });
  if (!any) return null;
  const deadline = project.deadline || any.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return Task.create({
    title: title || "Requirement",
    description: description || "Complete this requirement",
    projectId: project._id,
    assignedTo: userId,
    requirementId,
    priority: priority || project.priority || "medium",
    status: "pending",
    deadline,
    startedAt: null,
    completedRequirements: [],
  });
}

async function syncMemberCurrentRequirement(project, userId, requirementId) {
  const ms = project.memberStatuses.find((m) => m.user.toString() === userId.toString());
  if (ms) {
    ms.currentRequirement = requirementId;
    ms.status = "in-progress";
    ms.updatedAt = new Date();
  } else {
    project.memberStatuses.push({
      user: userId,
      status: "in-progress",
      currentRequirement: requirementId,
      updatedAt: new Date(),
    });
  }
}

async function persistMemberCurrentRequirement(projectId, userId, requirementId) {
  const p = await Project.findById(projectId);
  if (!p) return;
  await syncMemberCurrentRequirement(p, userId, requirementId);
  await p.save();
}

async function buildCompletionsByRequirement(projectId) {
  const tasks = await Task.find({
    projectId,
    requirementId: { $ne: null },
    status: "completed",
  })
    .populate("assignedTo", "name email")
    .lean();

  const map = {};
  for (const t of tasks) {
    const rid = String(t.requirementId);
    if (!map[rid]) map[rid] = [];
    map[rid].push({
      student: t.assignedTo,
      completedAt: t.completedAt,
    });
  }
  return map;
}

/** Collection-first; fall back to legacy embedded subdocs on Project */
async function listRequirementsForProject(projectDoc) {
  const pid = projectDoc._id;
  const fromDb = await Requirement.find({ project: pid }).sort({ createdAt: 1 }).lean();
  if (fromDb.length) return fromDb;
  const emb = projectDoc.requirements || [];
  return emb.map((r) => {
    const raw = r.toObject ? r.toObject() : r;
    return {
      ...raw,
      _id: r._id,
      project: pid,
      timeLimitMinutes:
        (raw.timeLimitHours || 0) * 60 +
        (raw.timeLimitMinutes || 0) +
        Math.ceil((raw.timeLimitSeconds || 0) / 60),
    };
  });
}

router.get("/project/:projectId", authMiddleware, async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!(await userCanAccessProject(req.user, project))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const requirements = await listRequirementsForProject(project);
    const completionsByReq = await buildCompletionsByRequirement(project._id);

    const out = requirements.map((r) => ({
      ...r,
      studentCompletions: completionsByReq[String(r._id)] || [],
    }));

    res.json(out);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/student/:studentId", authMiddleware, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { projectId } = req.query;
    if (!projectId) return res.status(400).json({ message: "projectId query parameter is required" });

    if (req.user.role === "member" && String(studentId) !== String(req.user._id)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!(await userCanAccessProject(req.user, project))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const coll = await Requirement.find({ project: project._id }).lean();
    const collById = Object.fromEntries(coll.map((x) => [String(x._id), x]));

    const requirements = await listRequirementsForProject(project);
    const tasks = await Task.find({
      projectId: project._id,
      assignedTo: studentId,
      requirementId: { $ne: null },
    }).lean();
    const taskByReq = Object.fromEntries(tasks.map((t) => [String(t.requirementId), t]));

    const results = requirements.map((r) => {
      const full = r.toObject?.() || r;
      const collRow = collById[String(r._id)];
      const global = collRow || full;
      const t = taskByReq[String(r._id)];

      let status = global.status || "pending";
      let startedAt = global.startedAt || null;
      const startedBy = global.startedBy || null;

      if (t?.status === "completed") status = "completed";

      const lockedByOther =
        status === "in-progress" && startedBy && String(startedBy) !== String(studentId);

      return {
        projectId: project._id,
        projectTitle: project.title,
        requirement: {
          ...full,
          status,
          startedAt,
          startedBy,
          lockedByOther,
          timeLimitMinutes: collRow ? collRow.timeLimitMinutes : full.timeLimitMinutes || embeddedTimeLimitMinutes(full),
        },
      };
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/project/:projectId", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const { title, description, priority, deadline, timeLimitMinutes } = req.body;
    const project = await Project.findById(req.params.projectId);
    if (!project) return res.status(404).json({ message: "Project not found" });
    if (!(await userCanAccessProject(req.user, project))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (!title || !String(title).trim()) {
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

    const minutes = Math.max(0, parseInt(timeLimitMinutes, 10) || 0);
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
    (project.memberStatuses || []).forEach((ms) => {
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
      message: `New requirement added: ${requirement.title}`,
    });

    res.status(201).json(requirement);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/start", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const bundle = await loadRequirementBundle(req.params.id);
    if (!bundle) return res.status(404).json({ message: "Requirement not found" });

    if (!(await userCanAccessProject(req.user, bundle.project))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const title = bundle.kind === "collection" ? bundle.requirement.title : bundle.sub.title;
    const description = bundle.kind === "collection" ? bundle.requirement.description : bundle.sub.description;
    const priority = bundle.kind === "collection" ? bundle.requirement.priority : bundle.sub.priority;
    const rid = bundle.kind === "collection" ? bundle.requirement._id : bundle.sub._id;

    let task = await ensureStudentTaskForRequirement(userId, bundle.project, rid, title, description, priority);
    if (!task) {
      return res.status(400).json({
        message: "Start the project first so tasks are created for you.",
      });
    }
    if (task.status === "completed") {
      return res.status(400).json({ message: COMPLETED_MSG });
    }

    const otherReqInProgress = await Task.findOne({
      projectId: bundle.project._id,
      assignedTo: userId,
      status: "in-progress",
      requirementId: { $ne: rid },
    });
    if (otherReqInProgress) {
      return res.status(400).json({
        message: "You already started another requirement. Complete it first before starting a new one.",
        currentRequirement: otherReqInProgress.requirementId,
      });
    }

    const now = new Date();

    if (bundle.kind === "collection") {
      const reqDoc = bundle.requirement;
      if (reqDoc.status === "completed") {
        return res.status(400).json({ message: COMPLETED_MSG });
      }
      if (reqDoc.status === "in-progress") {
        if (String(reqDoc.startedBy) === String(userId)) {
          task.status = "in-progress";
          task.startedAt = reqDoc.startedAt || task.startedAt || now;
          await task.save();
          await persistMemberCurrentRequirement(bundle.project._id, userId, rid);
          return res.status(200).json({
            success: true,
            message: "Requirement already in progress for you.",
            startedAt: reqDoc.startedAt,
            requirement: { _id: reqDoc._id, title: reqDoc.title, startedAt: reqDoc.startedAt },
          });
        }
        return res.status(403).json({ message: LOCK_MSG });
      }

      const claimed = await Requirement.findOneAndUpdate(
        { _id: reqDoc._id, status: "pending" },
        { $set: { status: "in-progress", startedAt: now, startedBy: userId } },
        { new: true }
      );

      if (!claimed) {
        const again = await Requirement.findById(reqDoc._id);
        if (again?.status === "in-progress" && String(again.startedBy) === String(userId)) {
          task.status = "in-progress";
          task.startedAt = again.startedAt || now;
          await task.save();
          await persistMemberCurrentRequirement(bundle.project._id, userId, rid);
          return res.status(200).json({
            success: true,
            message: "Requirement started successfully",
            startedAt: again.startedAt,
            requirement: { _id: again._id, title: again.title, startedAt: again.startedAt },
          });
        }
        if (again?.status === "completed") {
          return res.status(400).json({ message: COMPLETED_MSG });
        }
        return res.status(403).json({ message: LOCK_MSG });
      }

      task.status = "in-progress";
      task.startedAt = claimed.startedAt;
      await task.save();
      await persistMemberCurrentRequirement(bundle.project._id, userId, rid);

      return res.status(200).json({
        success: true,
        message: "Requirement started successfully",
        startedAt: claimed.startedAt,
        requirement: { _id: claimed._id, title: claimed.title, startedAt: claimed.startedAt },
      });
    }

    const project = bundle.project;
    const sub = bundle.sub;
    if (sub.status === "completed") {
      return res.status(400).json({ message: COMPLETED_MSG });
    }
    if (sub.status === "in-progress") {
      if (String(sub.startedBy) === String(userId)) {
        task.status = "in-progress";
        task.startedAt = sub.startedAt || task.startedAt || now;
        await task.save();
        await syncMemberCurrentRequirement(project, userId, rid);
        await project.save();
        return res.status(200).json({
          success: true,
          message: "Requirement already in progress for you.",
          startedAt: sub.startedAt,
          requirement: { _id: sub._id, title: sub.title, startedAt: sub.startedAt },
        });
      }
      return res.status(403).json({ message: LOCK_MSG });
    }

    const upd = await Project.updateOne(
      { _id: project._id, requirements: { $elemMatch: { _id: sub._id, status: "pending" } } },
      { $set: { "requirements.$.status": "in-progress", "requirements.$.startedAt": now, "requirements.$.startedBy": userId } }
    );

    if (upd.modifiedCount === 0) {
      const fresh = await Project.findById(project._id);
      const s2 = fresh.requirements.id(sub._id);
      if (s2?.status === "in-progress" && String(s2.startedBy) === String(userId)) {
        task.status = "in-progress";
        task.startedAt = s2.startedAt || now;
        await task.save();
        await syncMemberCurrentRequirement(fresh, userId, rid);
        return res.status(200).json({
          success: true,
          message: "Requirement started successfully",
          startedAt: s2.startedAt,
          requirement: { _id: s2._id, title: s2.title, startedAt: s2.startedAt },
        });
      }
      if (s2?.status === "completed") return res.status(400).json({ message: COMPLETED_MSG });
      return res.status(403).json({ message: LOCK_MSG });
    }

    task.status = "in-progress";
    task.startedAt = now;
    await task.save();
    const reloaded = await Project.findById(project._id);
    await syncMemberCurrentRequirement(reloaded, userId, rid);
    await reloaded.save();

    return res.status(200).json({
      success: true,
      message: "Requirement started successfully",
      startedAt: now,
      requirement: { _id: sub._id, title: sub.title, startedAt: now },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post("/:id/complete", authMiddleware, async (req, res) => {
  try {
    const userId = req.user._id;
    const bundle = await loadRequirementBundle(req.params.id);
    if (!bundle) return res.status(404).json({ message: "Requirement not found" });

    if (!(await userCanAccessProject(req.user, bundle.project))) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const rid = bundle.kind === "collection" ? bundle.requirement._id : bundle.sub._id;
    const title = bundle.kind === "collection" ? bundle.requirement.title : bundle.sub.title;

    const task = await Task.findOne({
      projectId: bundle.project._id,
      assignedTo: userId,
      requirementId: rid,
    });
    if (!task) {
      return res.status(400).json({ message: "No task for this requirement. Start the project first." });
    }
    if (task.status === "completed") {
      return res.status(400).json({ message: "Requirement already completed" });
    }

    let limitMin = 0;
    let startedAt = null;

    if (bundle.kind === "collection") {
      const r = await Requirement.findById(rid);
      if (!r) return res.status(404).json({ message: "Requirement not found" });
      limitMin = Math.max(0, r.timeLimitMinutes || 0);
      startedAt = r.startedAt ? new Date(r.startedAt) : null;
      if (r.status === "completed") {
        return res.status(400).json({ message: COMPLETED_MSG });
      }
      if (String(r.startedBy || "") !== String(userId)) {
        return res.status(403).json({ message: "Only the student who started this requirement can submit it." });
      }
    } else {
      const projectFresh = await Project.findById(bundle.project._id);
      const sub = projectFresh.requirements.id(rid);
      if (!sub) return res.status(404).json({ message: "Requirement not found" });
      limitMin = embeddedTimeLimitMinutes(sub);
      startedAt = sub.startedAt ? new Date(sub.startedAt) : null;
      if (sub.status === "completed") {
        return res.status(400).json({ message: COMPLETED_MSG });
      }
      if (String(sub.startedBy || "") !== String(userId)) {
        return res.status(403).json({ message: "Only the student who started this requirement can submit it." });
      }
    }

    if (task.status !== "in-progress") {
      return res.status(400).json({ message: "You haven't started this requirement yet. Click 'Start' first." });
    }

    if (limitMin > 0) {
      if (!startedAt) {
        return res.status(400).json({ message: "Missing start time. Click 'Start' again." });
      }
      const elapsedMs = Date.now() - startedAt.getTime();
      const requiredMs = limitMin * 60 * 1000;
      if (elapsedMs < requiredMs) {
        const leftMs = requiredMs - elapsedMs;
        const leftMin = Math.max(1, Math.ceil(leftMs / 60000));
        const leftSec = Math.max(0, Math.ceil(leftMs / 1000) % 60);
        return res.status(400).json({
          message: `Wait ${leftMin}m ${leftSec}s before submitting.`,
          minutesRemaining: leftMin,
        });
      }
    }

    const now = new Date();

    if (bundle.kind === "collection") {
      const r = await Requirement.findById(rid);
      if (!r || r.status === "completed") {
        return res.status(400).json({ message: COMPLETED_MSG });
      }
      if (String(r.startedBy || "") !== String(userId)) {
        return res.status(403).json({ message: "Only the student who started this requirement can submit it." });
      }
      r.status = "completed";
      r.completedAt = now;
      r.completedBy = userId;
      await r.save();
    } else {
      const project = await Project.findById(bundle.project._id);
      const sub = project.requirements.id(rid);
      if (!sub || sub.status === "completed") {
        return res.status(400).json({ message: COMPLETED_MSG });
      }
      if (String(sub.startedBy || "") !== String(userId)) {
        return res.status(403).json({ message: "Only the student who started this requirement can submit it." });
      }
      sub.status = "completed";
      sub.completedAt = now;
      sub.completedBy = userId;
      await project.save();
    }

    const wasTaskDone = task.status === "completed";
    await task.addCompletedRequirementAndRefreshStatus(rid);
    if (!wasTaskDone && task.status === "completed") {
      await User.findByIdAndUpdate(userId, { $inc: { completedTasks: 1 } }).catch(() => {});
    }

    await Task.updateMany(
      {
        projectId: bundle.project._id,
        requirementId: rid,
        assignedTo: { $ne: userId },
        status: { $nin: ["completed"] },
      },
      { $set: { status: "blocked" } }
    );

    const projectForMs = await Project.findById(bundle.project._id);
    const userMemberStatus = projectForMs.memberStatuses.find((ms) => ms.user.toString() === userId.toString());
    if (userMemberStatus) {
      if (!userMemberStatus.completedRequirements) userMemberStatus.completedRequirements = [];
      const idStr = rid.toString();
      if (!userMemberStatus.completedRequirements.some((id) => id.toString() === idStr)) {
        userMemberStatus.completedRequirements.push(rid);
      }
      userMemberStatus.currentRequirement = null;
      userMemberStatus.updatedAt = now;
    }
    await projectForMs.save();

    await Activity.create({
      type: "requirement_completed",
      actor: userId,
      project: bundle.project._id,
      message: `${req.user.name} completed requirement: ${title}`,
    });

    return res.status(200).json({ success: true, message: "Requirement completed successfully!" });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }
    console.error("Requirement complete error:", error);
    res.status(500).json({ message: error.message });
  }
});

router.delete("/:id", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const requirement = await Requirement.findById(req.params.id);
    if (!requirement) return res.status(404).json({ message: "Not found" });
    const project = await Project.findById(requirement.project);
    if (!project || !(await userCanAccessProject(req.user, project))) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await Task.updateMany({ requirementId: requirement._id }, { $unset: { requirementId: 1 } });
    await Requirement.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
