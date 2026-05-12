const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");  // ✅ ONLY ONE TIME at top
const User = require("../models/User");
const Batch = require("../models/Batch");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");

const router = express.Router();
const ADMIN_EMAIL = "admin@ethara.com";
const ADMIN_PASSWORD = "admin123";

// ❌ YAHAN SE HATA DO - Duplicate require
// const jwt = require("jsonwebtoken");  // DELETE THIS LINE

const getAllowedBatchNames = async () => {
  const batchDocs = await Batch.find({}).select("name").lean();
  const fromBatchModel = batchDocs.map((b) => String(b.name).trim()).filter(Boolean);

  const guideBatches = await User.find({ role: "guide", assignedBatch: { $ne: "" } })
    .distinct("assignedBatch");
  const fromGuides = (guideBatches || []).map((b) => String(b).trim()).filter(Boolean);

  const memberBatches = await User.find({ role: "member", batch: { $ne: "" } }).distinct("batch");
  const fromMembers = (memberBatches || []).map((b) => String(b).trim()).filter(Boolean);

  return [...new Set([...fromBatchModel, ...fromGuides, ...fromMembers])].sort((a, b) => a.localeCompare(b));
};

// Public: list batches for signup dropdown
// GET /api/auth/batches
router.get("/batches", async (req, res) => {
  try {
    const batches = await getAllowedBatchNames();
    return res.json({ batches });
  } catch (error) {
    return res.status(500).json({ message: "Failed to fetch batches", error: error.message });
  }
});

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password, batch } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL) {
      return res.status(403).json({ message: "This email is reserved for system admin login only" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const chosenBatch = typeof batch === "string" ? batch.trim() : "";
    if (!chosenBatch) {
      return res.status(400).json({ message: "Batch is required" });
    }
    const allowedBatches = await getAllowedBatchNames();
    if (allowedBatches.length > 0 && !allowedBatches.includes(chosenBatch)) {
      return res.status(400).json({ message: "Invalid batch selection. Please choose a valid batch." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role: "member",
      batch: chosenBatch,
      isActive: true,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to signup", error: error.message });
  }
});

// ADMIN ONLY: Create Guide/Leader account (guide role)
// POST /api/auth/admin/create-guide
router.post("/admin/create-guide", authMiddleware, roleMiddleware("admin"), async (req, res) => {
  try {
    const { name, email, password, assignedBatch, batch, accountType } = req.body || {};
    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    if (normalizedEmail === ADMIN_EMAIL) {
      return res.status(400).json({ message: "This email is reserved for system admin" });
    }

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({ message: "Email already in use" });
    }

    const generatedPassword =
      password && String(password).trim().length >= 4
        ? null
        : Math.random().toString(36).slice(2, 10) + "A1";
    const plainPassword = generatedPassword || String(password);
    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    const guide = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "guide",
      guideType: accountType === "leader" ? "leader" : "guide",
      canEditAttendance: accountType === "leader" ? false : true,
      assignedBatch: typeof assignedBatch === "string" ? assignedBatch.trim() : "",
      // Some parts of the app fallback to `batch` if `assignedBatch` isn't set.
      batch: typeof batch === "string" ? batch.trim() : "",
      isActive: true,
    });

    return res.status(201).json({
      message: "Guide account created",
      user: {
        id: guide._id,
        name: guide.name,
        email: guide.email,
        role: guide.role,
        guideType: guide.guideType,
        canEditAttendance: guide.canEditAttendance,
        assignedBatch: guide.assignedBatch,
        batch: guide.batch,
      },
      ...(generatedPassword ? { generatedPassword } : {}),
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to create guide account", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === ADMIN_EMAIL) {
      if (password !== ADMIN_PASSWORD) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      let adminUser = await User.findOne({ email: ADMIN_EMAIL });
      const hashedAdminPassword = adminUser?.password || (await bcrypt.hash(ADMIN_PASSWORD, 10));

      if (!adminUser) {
        adminUser = await User.create({
          name: "System Admin",
          email: ADMIN_EMAIL,
          password: hashedAdminPassword,
          role: "admin",
          rating: 5,
          isActive: true,
        });
      } else {
        adminUser.role = "admin";
        adminUser.isActive = true;
        adminUser.kickedAt = null;
        // Keep the stored hash stable once set (avoids re-hashing every login)
        if (!adminUser.password) adminUser.password = hashedAdminPassword;
        await adminUser.save();
      }

      // 🔥 Use userId for consistency with middleware
      const token = jwt.sign(
        { userId: adminUser._id, role: adminUser.role }, 
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      return res.json({
        token,
        user: {
          id: adminUser._id,
          name: adminUser.name,
          email: adminUser.email,
          role: adminUser.role,
          batch: adminUser.batch,
        },
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.role === "admin" && user.email !== ADMIN_EMAIL) {
      user.role = "member";
      await user.save();
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      return res.status(403).json({
        message: "Your account has been deactivated. Contact an administrator.",
      });
    }

    // 🔥 Use userId for consistency with middleware
    const token = jwt.sign(
      { userId: user._id, role: user.role }, 
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        batch: user.batch,
        assignedBatch: user.assignedBatch,
        guideType: user.guideType,
        canEditAttendance: user.canEditAttendance,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to login", error: error.message });
  }
});

module.exports = router;