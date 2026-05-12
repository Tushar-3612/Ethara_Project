const express = require("express");
const mongoose = require("mongoose");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();

const pad2 = (n) => String(n).padStart(2, "0");

/** Local calendar YYYY-MM-DD */
const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const getStatusFromTime = (totalMinutes) => {
  if (totalMinutes <= 540) {
    return { status: "present", isLate: false, lateMinutes: 0 };
  }
  if (totalMinutes <= 600) {
    return { status: "late", isLate: true, lateMinutes: totalMinutes - 540 };
  }
  if (totalMinutes <= 720) {
    return { status: "half-day", isLate: true, lateMinutes: totalMinutes - 540 };
  }
  return { status: "absent", isLate: true, lateMinutes: totalMinutes - 540 };
};

/** Student punch-in allowed 09:00–09:59:59 local */
const withinStudentPunchWindow = (d) => {
  const h = d.getHours();
  const m = d.getMinutes();
  const mins = h * 60 + m;
  const start = 9 * 60;
  const end = 10 * 60;
  return mins >= start && mins < end;
};

/** All batch labels linked to this guide */
const guideBatchesForUser = (guide) => {
  const a = (guide.assignedBatch || "").trim();
  const b = (guide.batch || "").trim();
  return [...new Set([a, b].filter(Boolean))];
};

const assertGuideOwnsStudent = async (guide, studentId) => {
  const batches = guideBatchesForUser(guide);
  if (batches.length === 0) return { ok: false, message: "No batch assigned to guide" };
  const student = await User.findOne({
    _id: studentId,
    role: "member",
    batch: { $in: batches },
  }).select("_id");
  if (!student) return { ok: false, message: "Student is not in your batch" };
  return { ok: true };
};

const pushEditHistory = (doc, entry) => {
  if (!Array.isArray(doc.editHistory)) {
    doc.editHistory = [];
  }
  doc.editHistory.push(entry);
};

router.get("/today", authMiddleware, async (req, res) => {
  try {
    const now = new Date();
    const dateKey = toDateKey(now);
    const doc = await Attendance.findOne({ user: req.user._id, dateKey });
    return res.json(doc || { user: req.user._id, dateKey, punchIn: null, status: "absent" });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch attendance", error: error.message });
  }
});

router.post("/punch-in", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "member") {
      return res.status(403).json({ message: "Only members can mark attendance" });
    }

    const now = new Date();

    if (!withinStudentPunchWindow(now)) {
      return res.status(400).json({
        message: "Attendance can only be marked between 9:00 AM and 10:00 AM (local time).",
      });
    }

    const dateKey = toDateKey(now);
    const actualHours = now.getHours();
    const actualMinutes = now.getMinutes();
    const actualSeconds = now.getSeconds();

    const actualPunchTime = `${pad2(actualHours)}:${pad2(actualMinutes)}:${pad2(actualSeconds)}`;
    const actualTotalMinutes = actualHours * 60 + actualMinutes;
    const { status, isLate, lateMinutes } = getStatusFromTime(actualTotalMinutes);

    await User.findByIdAndUpdate(req.user._id, { lastActive: now, isActive: true });

    let attendance = await Attendance.findOne({ user: req.user._id, dateKey });

    if (!attendance) {
      attendance = new Attendance({
        user: req.user._id,
        dateKey,
        date: dateKey,
        punchIn: now,
        punchInTime: actualPunchTime,
        actualPunchTime,
        status,
        isLate,
        lateMinutes,
        markedByName: "Self",
      });
    } else {
      attendance.punchIn = now;
      attendance.punchInTime = actualPunchTime;
      attendance.actualPunchTime = actualPunchTime;
      attendance.date = dateKey;
      attendance.status = status;
      attendance.isLate = isLate;
      attendance.lateMinutes = lateMinutes;
    }

    await attendance.save();
    return res.json(attendance);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Attendance already recorded for today." });
    }
    console.error("Punch In Error:", error);
    return res.status(500).json({ message: "Failed to punch in", error: error.message });
  }
});

router.get("/date/:date", authMiddleware, async (req, res) => {
  try {
    const { date } = req.params;
    let query = { dateKey: date };

    if (req.user.role === "guide") {
      const batches = guideBatchesForUser(req.user);
      if (batches.length === 0) return res.json([]);
      const batchUsers = await User.find({ batch: { $in: batches }, role: "member" }).select("_id");
      query.user = { $in: batchUsers.map((u) => u._id) };
    } else if (req.user.role === "member") {
      query.user = req.user._id;
    }

    const records = await Attendance.find(query).populate("user", "name email batch role");
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** Guide or admin edit attendance with optional punch time */
router.put("/record/:id", authMiddleware, async (req, res) => {
  try {
    if (!["guide", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid attendance id" });
    }

    const { status, reason, punchTime } = req.body || {};
    if (!["present", "absent", "late", "half-day"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const attendance = await Attendance.findById(id).populate("user", "batch role");
    if (!attendance) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const studentId = attendance.user?._id || attendance.user;
    if (req.user.role === "guide") {
      const own = await assertGuideOwnsStudent(req.user, studentId);
      if (!own.ok) return res.status(403).json({ message: own.message });
    }

    const oldStatus = attendance.status;
    const now = new Date();

    attendance.status = status;
    attendance.reason = reason || attendance.reason;
    attendance.markedBy = req.user._id;
    attendance.markedByName = req.user.name;
    attendance.isEdited = true;
    attendance.editedAt = now;

    if (punchTime && punchTime !== attendance.punchInTime) {
      attendance.punchInTime = punchTime;
      attendance.actualPunchTime = punchTime;
      const [hours, minutes] = punchTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes;
      const { isLate, lateMinutes } = getStatusFromTime(totalMinutes);
      attendance.isLate = isLate;
      attendance.lateMinutes = lateMinutes;
    }

    if (!attendance.date && attendance.dateKey) {
      attendance.date = attendance.dateKey;
    }

    pushEditHistory(attendance, {
      editedBy: req.user._id,
      editedByName: req.user.name,
      oldStatus,
      newStatus: status,
      reason: reason || (req.user.role === "admin" ? "Edited by admin" : "Edited by guide"),
      editedAt: now,
    });

    await attendance.save();
    const updated = await Attendance.findById(attendance._id).populate("user", "name email batch role");
    res.json(updated);
  } catch (error) {
    console.error("Edit Error:", error);
    res.status(500).json({ message: error.message });
  }
});

/** Guide or admin: create or replace attendance */
router.post("/guide/mark", authMiddleware, async (req, res) => {
  try {
    if (!["guide", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    const { userId, dateKey, status, reason, punchTime } = req.body || {};
    if (!userId || !dateKey || !["present", "absent", "late", "half-day"].includes(status)) {
      return res.status(400).json({ message: "userId, dateKey, and valid status are required" });
    }
    if (!mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    if (req.user.role === "guide") {
      const own = await assertGuideOwnsStudent(req.user, userId);
      if (!own.ok) return res.status(403).json({ message: own.message });
    }

    const now = new Date();
    let doc = await Attendance.findOne({ user: userId, dateKey });
    
    const finalPunchTime = punchTime || null;
    let finalIsLate = false;
    let finalLateMinutes = 0;
    
    if (finalPunchTime) {
      const [hours, minutes] = finalPunchTime.split(":").map(Number);
      const totalMinutes = hours * 60 + minutes;
      const statusCalc = getStatusFromTime(totalMinutes);
      finalIsLate = statusCalc.isLate;
      finalLateMinutes = statusCalc.lateMinutes;
    }

    if (!doc) {
      doc = new Attendance({
        user: userId,
        dateKey,
        date: dateKey,
        status,
        reason: reason || "",
        punchInTime: finalPunchTime,
        actualPunchTime: finalPunchTime,
        isLate: finalIsLate,
        lateMinutes: finalLateMinutes,
        markedBy: req.user._id,
        markedByName: req.user.name,
        isEdited: true,
        editedAt: now,
      });
    } else {
      const oldStatus = doc.status;
      doc.status = status;
      doc.reason = reason || doc.reason;
      doc.markedBy = req.user._id;
      doc.markedByName = req.user.name;
      doc.isEdited = true;
      doc.editedAt = now;
      doc.date = dateKey;
      
      if (finalPunchTime) {
        doc.punchInTime = finalPunchTime;
        doc.actualPunchTime = finalPunchTime;
        doc.isLate = finalIsLate;
        doc.lateMinutes = finalLateMinutes;
      }
      
      pushEditHistory(doc, {
        editedBy: req.user._id,
        editedByName: req.user.name,
        oldStatus,
        newStatus: status,
        reason: reason || (req.user.role === "admin" ? "Marked by admin" : "Marked by guide"),
        editedAt: now,
      });
    }

    await doc.save();
    const out = await Attendance.findById(doc._id).populate("user", "name email batch role");
    res.json(out);
  } catch (error) {
    console.error("guide mark", error);
    res.status(500).json({ message: error.message });
  }
});

/** Guide: full batch roster for one day */
router.get("/guide/day/:dateKey", authMiddleware, roleMiddleware("guide"), async (req, res) => {
  try {
    const batches = guideBatchesForUser(req.user);
    if (batches.length === 0) return res.status(400).json({ message: "No batch assigned" });
    
    const { dateKey } = req.params;
    const students = await User.find({ batch: { $in: batches }, role: "member" })
      .select("_id name email batch")
      .sort({ name: 1 })
      .lean();
    const records = await Attendance.find({ dateKey, user: { $in: students.map((s) => s._id) } })
      .populate("user", "name email batch role")
      .lean();

    const byUser = new Map(records.map((r) => [String(r.user._id || r.user), r]));
    const rows = students.map((s) => ({
      user: s,
      attendance: byUser.get(String(s._id)) || null,
    }));

    res.json({ batch: batches.join(", "), dateKey, rows });
  } catch (error) {
    console.error("guide day", error);
    res.status(500).json({ message: error.message });
  }
});

/** Admin: all members, every batch */
router.get("/admin/day/:dateKey", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { dateKey } = req.params;
    const students = await User.find({ role: "member" })
      .select("_id name email batch")
      .sort({ batch: 1, name: 1 })
      .lean();
    const records = await Attendance.find({ dateKey, user: { $in: students.map((s) => s._id) } })
      .populate("user", "name email batch role")
      .lean();

    const byUser = new Map(records.map((r) => [String(r.user._id || r.user), r]));
    const rows = students.map((s) => ({
      user: s,
      attendance: byUser.get(String(s._id)) || null,
    }));

    res.json({ batch: "All batches", dateKey, rows });
  } catch (error) {
    console.error("admin day", error);
    res.status(500).json({ message: error.message });
  }
});

/** Member: recent attendance history */
router.get("/my/history", authMiddleware, roleMiddleware("member"), async (req, res) => {
  try {
    const days = Math.min(60, Math.max(1, parseInt(req.query.days || "14", 10) || 14));
    const keys = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      keys.push(toDateKey(d));
    }
    const records = await Attendance.find({ user: req.user._id, dateKey: { $in: keys } })
      .sort({ dateKey: -1 })
      .lean();
    res.json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get("/monthly-stats", authMiddleware, async (req, res) => {
  try {
    const { month } = req.query;
    const startDate = `${month}-01`;
    const endDate = `${month}-${new Date(parseInt(month.split("-")[0], 10), parseInt(month.split("-")[1], 10), 0).getDate()}`;

    let query = { dateKey: { $gte: startDate, $lte: endDate } };

    if (req.user.role === "guide") {
      const batches = guideBatchesForUser(req.user);
      const batchUsers = await User.find({
        batch: { $in: batches.length ? batches : ["__none__"] },
        role: "member",
      }).select("_id");
      query.user = { $in: batchUsers.map((u) => u._id) };
    } else if (req.user.role === "member") {
      query.user = req.user._id;
    }

    const records = await Attendance.find(query);
    const stats = {
      present: records.filter((r) => r.status === "present").length,
      absent: records.filter((r) => r.status === "absent").length,
      late: records.filter((r) => r.status === "late").length,
      halfDay: records.filter((r) => r.status === "half-day").length,
      total: records.length,
      percentage: records.length > 0 ? Math.round((records.filter((r) => r.status === "present").length / records.length) * 100) : 0,
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;