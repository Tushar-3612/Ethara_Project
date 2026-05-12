const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Project = require("../models/Project");
const {
  attendanceToWorkbook,
  projectsToWorkbook,
  individualStudentWorkbook,
  rowsToCsv,
  workbookToBuffer,
} = require("../utils/excelGenerator");

const router = express.Router();

const guideBatch = (u) => (u.assignedBatch || u.batch || "").trim();

const parseRange = (from, to) => {
  if (!from || !to) return null;
  if (from > to) return null;
  return { from, to };
};

/** Guide-only: students in batch */
async function batchMemberIds(batch) {
  if (!batch) return [];
  const users = await User.find({ batch, role: "member" }).select("_id").lean();
  return users.map((u) => u._id);
}

/** @param {import('mongoose').Types.ObjectId[]} userIds */
async function attendanceAggregatesForUsers(userIds, from, to) {
  const match = {
    user: { $in: userIds },
    dateKey: { $gte: from, $lte: to },
  };
  const rows = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$user",
        totalDays: { $sum: 1 },
        present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
        late: {
          $sum: {
            $cond: [{ $in: ["$status", ["late", "half-day"]] }, 1, 0],
          },
        },
      },
    },
  ]);
  const map = new Map(rows.map((r) => [String(r._id), r]));
  return map;
}

/** Project counts per member from memberStatuses across relevant projects */
function projectStatsForUsers(projects, userIds) {
  const idSet = new Set(userIds.map((id) => String(id)));
  const stats = new Map();
  userIds.forEach((id) => {
    stats.set(String(id), { total: 0, completed: 0, inProgress: 0 });
  });

  for (const p of projects) {
    const statuses = p.memberStatuses || [];
    for (const ms of statuses) {
      const uid = String(ms.user);
      if (!idSet.has(uid)) continue;
      const row = stats.get(uid);
      if (!row) continue;
      row.total += 1;
      if (ms.status === "completed") row.completed += 1;
      else if (ms.status === "in-progress") row.inProgress += 1;
    }
  }
  return stats;
}

/** GET metrics table for Reports UI */
router.get("/guide/metrics", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const batch = guideBatch(req.user);
    if (!batch) {
      return res.status(400).json({ message: "No batch assigned to this guide" });
    }
    const from = req.query.from;
    const to = req.query.to;
    const range = parseRange(from, to);
    if (!range) {
      return res.status(400).json({ message: "Query params from and to (YYYY-MM-DD) are required" });
    }

    const members = await User.find({ batch, role: "member" })
      .select("_id name email batch completedProjects")
      .lean();
    const userIds = members.map((m) => m._id);
    const attMap = await attendanceAggregatesForUsers(userIds, range.from, range.to);

    const projects = await Project.find({
      $or: [{ targetBatches: batch }, { "memberStatuses.user": { $in: userIds } }],
    })
      .select("memberStatuses title")
      .lean();

    const projMap = projectStatsForUsers(projects, userIds);

    const payload = members.map((m) => {
      const id = String(m._id);
      const a = attMap.get(id) || { totalDays: 0, present: 0, absent: 0, late: 0 };
      const total = a.totalDays || 0;
      const denom = total > 0 ? total : 1;
      const attendancePct = Math.round(((a.present + a.late) / denom) * 1000) / 10;
      const p = projMap.get(id) || { total: 0, completed: 0, inProgress: 0 };
      const avgProjects =
        p.total > 0 ? Math.round((p.completed / p.total) * 1000) / 10 : 0;

      return {
        userId: m._id,
        name: m.name,
        email: m.email,
        batch: m.batch,
        attendancePct: total ? attendancePct : 0,
        attendanceBreakdown: { ...a },
        totalProjectsTracked: p.total,
        projectsCompleted: p.completed,
        projectsInProgress: p.inProgress,
        avgCompletionRatePct: avgProjects,
        completedProjectsField: m.completedProjects || 0,
      };
    });

    return res.json({ batch, from: range.from, to: range.to, students: payload });
  } catch (error) {
    console.error("guide metrics", error);
    return res.status(500).json({ message: "Failed to build metrics", error: error.message });
  }
});

/** Attendance report — full batch or one student */
router.get("/attendance", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const batch = guideBatch(req.user);
    if (!batch) {
      return res.status(400).json({ message: "No batch assigned" });
    }
    const range = parseRange(req.query.from, req.query.to);
    if (!range) {
      return res.status(400).json({ message: "from and to (YYYY-MM-DD) are required" });
    }
    const format = (req.query.format || "xlsx").toLowerCase();
    const studentId = req.query.studentId;

    let members = await User.find({
      batch,
      role: "member",
      ...(studentId ? { _id: studentId } : {}),
    })
      .select("_id name batch")
      .lean();

    if (studentId && members.length === 0) {
      return res.status(404).json({ message: "Student not found in your batch" });
    }

    const userIds = members.map((m) => m._id);
    const attMap = await attendanceAggregatesForUsers(userIds, range.from, range.to);

    const rows = members.map((m) => {
      const id = String(m._id);
      const a = attMap.get(id) || { totalDays: 0, present: 0, absent: 0, late: 0 };
      const total = a.totalDays || 0;
      const denom = total > 0 ? total : 1;
      const pct = Math.round(((a.present + a.late) / denom) * 1000) / 10;
      return {
        studentName: m.name,
        batch: m.batch || batch,
        totalDays: total,
        present: a.present,
        absent: a.absent,
        late: a.late,
        percentage: total ? `${pct}%` : "0%",
      };
    });

    if (format === "csv") {
      const csv = rowsToCsv(
        [
          { header: "Student Name", key: "studentName" },
          { header: "Batch", key: "batch" },
          { header: "Total Days", key: "totalDays" },
          { header: "Present", key: "present" },
          { header: "Absent", key: "absent" },
          { header: "Late", key: "late" },
          { header: "Percentage", key: "percentage" },
        ],
        rows
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="attendance-${range.from}-${range.to}.csv"`
      );
      return res.send(csv);
    }

    const wb = await attendanceToWorkbook(rows);
    const buf = await workbookToBuffer(wb);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="attendance-${range.from}-${range.to}.xlsx"`
    );
    return res.send(buf);
  } catch (error) {
    console.error("attendance report", error);
    return res.status(500).json({ message: "Report failed", error: error.message });
  }
});

/** Project completion report */
router.get("/projects", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const batch = guideBatch(req.user);
    if (!batch) {
      return res.status(400).json({ message: "No batch assigned" });
    }
    const format = (req.query.format || "xlsx").toLowerCase();
    const studentId = req.query.studentId;

    const members = await User.find({
      batch,
      role: "member",
      ...(studentId ? { _id: studentId } : {}),
    })
      .select("_id name batch")
      .lean();

    if (studentId && members.length === 0) {
      return res.status(404).json({ message: "Student not found in your batch" });
    }

    const userIds = members.map((m) => m._id);
    const projects = await Project.find({
      $or: [{ targetBatches: batch }, { "memberStatuses.user": { $in: userIds } }],
    })
      .select("memberStatuses")
      .lean();

    const projMap = projectStatsForUsers(projects, userIds);

    const rows = members.map((m) => {
      const id = String(m._id);
      const p = projMap.get(id) || { total: 0, completed: 0, inProgress: 0 };
      const rate =
        p.total > 0 ? Math.round((p.completed / p.total) * 1000) / 10 : 0;
      return {
        studentName: m.name,
        totalProjects: p.total,
        completed: p.completed,
        inProgress: p.inProgress,
        completionRate: `${rate}%`,
      };
    });

    if (format === "csv") {
      const csv = rowsToCsv(
        [
          { header: "Student Name", key: "studentName" },
          { header: "Total Projects", key: "totalProjects" },
          { header: "Completed", key: "completed" },
          { header: "In Progress", key: "inProgress" },
          { header: "Completion Rate %", key: "completionRate" },
        ],
        rows
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="projects-report.csv"`);
      return res.send(csv);
    }

    const wb = await projectsToWorkbook(rows);
    const buf = await workbookToBuffer(wb);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="projects-report.xlsx"`);
    return res.send(buf);
  } catch (error) {
    console.error("project report", error);
    return res.status(500).json({ message: "Report failed", error: error.message });
  }
});

/** One student — attendance rows + project rows */
router.get("/student/:id", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const batch = guideBatch(req.user);
    if (!batch) {
      return res.status(400).json({ message: "No batch assigned" });
    }
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid student id" });
    }

    const student = await User.findOne({
      _id: req.params.id,
      batch,
      role: "member",
    }).lean();

    if (!student) {
      return res.status(404).json({ message: "Student not found in your batch" });
    }

    const range = parseRange(req.query.from, req.query.to);
    if (!range) {
      return res.status(400).json({ message: "from and to (YYYY-MM-DD) are required" });
    }
    const format = (req.query.format || "xlsx").toLowerCase();

    const attendanceDocs = await Attendance.find({
      user: student._id,
      dateKey: { $gte: range.from, $lte: range.to },
    })
      .sort({ dateKey: 1 })
      .lean();

    const attendanceRows = attendanceDocs.map((a) => ({
      dateKey: a.dateKey,
      status: a.status,
      punchTime: a.actualPunchTime || a.punchInTime || "",
      lateMinutes: a.lateMinutes ?? "",
      reason: a.reason || "",
    }));

    const projects = await Project.find({
      "memberStatuses.user": student._id,
    })
      .select("title deadline memberStatuses")
      .lean();

    const projectRows = [];
    for (const p of projects) {
      const ms = (p.memberStatuses || []).find(
        (x) => String(x.user) === String(student._id)
      );
      if (!ms) continue;
      projectRows.push({
        title: p.title,
        status: ms.status,
        deadline: p.deadline ? new Date(p.deadline).toLocaleString() : "",
        startedAt: ms.startedAt ? new Date(ms.startedAt).toLocaleString() : "",
        completedAt: ms.completedAt ? new Date(ms.completedAt).toLocaleString() : "",
      });
    }

    if (format === "csv") {
      const aCsv = rowsToCsv(
        [
          { header: "Date", key: "dateKey" },
          { header: "Status", key: "status" },
          { header: "Punch Time", key: "punchTime" },
          { header: "Late (min)", key: "lateMinutes" },
          { header: "Notes", key: "reason" },
        ],
        attendanceRows
      );
      const pCsv = rowsToCsv(
        [
          { header: "Project", key: "title" },
          { header: "Status", key: "status" },
          { header: "Deadline", key: "deadline" },
          { header: "Started At", key: "startedAt" },
          { header: "Completed At", key: "completedAt" },
        ],
        projectRows
      );
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="student-${student.name.replace(/\s+/g, "_")}.csv"`
      );
      return res.send(`${aCsv}\n\n${pCsv}`);
    }

    const wb = await individualStudentWorkbook({
      studentName: student.name,
      attendanceRows,
      projectRows,
    });
    const buf = await workbookToBuffer(wb);
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="student-${String(student._id)}.xlsx"`
    );
    return res.send(buf);
  } catch (error) {
    console.error("student report", error);
    return res.status(500).json({ message: "Report failed", error: error.message });
  }
});

module.exports = router;
